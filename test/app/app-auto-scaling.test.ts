import * as Assert from "assert";
import test, { describe } from "node:test";
import { createTestCluster, createTestVpcDetails, findResource, initializePulumiMocks, settleResources, testImage, waitForResource } from "./app-test-harness.js";
import { GrpcAppProvisioner } from "../../src/app/grpc/grpc-app-provisioner.js";
import { WorkerAppProvisioner } from "../../src/app/worker/worker-app-provisioner.js";


await initializePulumiMocks();
const vpcDetails = createTestVpcDetails();
const targetType = "aws:appautoscaling/target:Target";
const policyType = "aws:appautoscaling/policy:Policy";
const alarmType = "aws:cloudwatch/metricAlarm:MetricAlarm";

interface TargetTrackingConfiguration
{
    targetValue: number;
    scaleOutCooldown: number;
    scaleInCooldown: number;
    predefinedMetricSpecification: { predefinedMetricType: string; };
}

interface StepAdjustment
{
    metricIntervalLowerBound?: string;
    metricIntervalUpperBound?: string;
    scalingAdjustment: number;
}

interface StepScalingConfiguration
{
    adjustmentType: string;
    cooldown: number;
    metricAggregationType: string;
    stepAdjustments: Array<StepAdjustment>;
}

await describe("App auto scaling", async () =>
{
    await describe("autoscaled grpc app", async () =>
    {
        await new GrpcAppProvisioner("grpc-as", {
            vpcDetails, subnetNamePrefix: "app", ingressSubnetNamePrefixes: ["ingress"], image: testImage, command: ["node"],
            cluster: createTestCluster(), minCapacity: 1, maxCapacity: 3
        }).provision();

        await test("keeps the cpu target tracking policy (45%, scale-out 30s, scale-in 300s)", async () =>
        {
            const policy = await waitForResource(policyType, "grpc-as-asp");
            Assert.strictEqual(policy.inputs["policyType"], "TargetTrackingScaling");
            const configuration = policy.inputs["targetTrackingScalingPolicyConfiguration"] as TargetTrackingConfiguration;
            Assert.strictEqual(configuration.targetValue, 45);
            Assert.strictEqual(configuration.scaleOutCooldown, 30);
            Assert.strictEqual(configuration.scaleInCooldown, 300);
            Assert.strictEqual(configuration.predefinedMetricSpecification.predefinedMetricType, "ECSServiceAverageCPUUtilization");
        });

        await test("adds a scale-out-only step policy on the same scalable target", async () =>
        {
            const policy = await waitForResource(policyType, "grpc-as-asp-step");
            Assert.strictEqual(policy.inputs["policyType"], "StepScaling");
            Assert.strictEqual(policy.inputs["resourceId"], "service/test-cluster/grpc-as-svc");
            Assert.strictEqual(policy.inputs["scalableDimension"], "ecs:service:DesiredCount");
            Assert.strictEqual(policy.inputs["serviceNamespace"], "ecs");
            const configuration = policy.inputs["stepScalingPolicyConfiguration"] as StepScalingConfiguration;
            Assert.strictEqual(configuration.adjustmentType, "ChangeInCapacity");
            Assert.strictEqual(configuration.cooldown, 60);
            Assert.strictEqual(configuration.metricAggregationType, "Average");
            Assert.deepStrictEqual(configuration.stepAdjustments, [
                { metricIntervalUpperBound: "15", scalingAdjustment: 1 },
                { metricIntervalLowerBound: "15", scalingAdjustment: 2 }
            ]);
            Assert.ok(configuration.stepAdjustments.every(t => t.scalingAdjustment > 0),
                "step policy must never scale in; target tracking owns scale-in");
        });

        await test("drives the step policy from a one-datapoint service cpu alarm", async () =>
        {
            const alarm = await waitForResource(alarmType, "grpc-as-asp-step-alm");
            Assert.strictEqual(alarm.inputs["namespace"], "AWS/ECS");
            Assert.strictEqual(alarm.inputs["metricName"], "CPUUtilization");
            Assert.deepStrictEqual(alarm.inputs["dimensions"], { ClusterName: "test-cluster", ServiceName: "grpc-as-svc" });
            Assert.strictEqual(alarm.inputs["statistic"], "Average");
            Assert.strictEqual(alarm.inputs["period"], 60);
            Assert.strictEqual(alarm.inputs["evaluationPeriods"], 1);
            Assert.strictEqual(alarm.inputs["datapointsToAlarm"], 1);
            Assert.strictEqual(alarm.inputs["threshold"], 75);
            Assert.strictEqual(alarm.inputs["comparisonOperator"], "GreaterThanOrEqualToThreshold");
            Assert.strictEqual(alarm.inputs["treatMissingData"], "notBreaching");
            Assert.deepStrictEqual(alarm.inputs["alarmActions"], ["arn:aws:mock:grpc-as-asp-step"]);
        });
    });

    await describe("fixed capacity worker", async () =>
    {
        await new WorkerAppProvisioner("wrk-fixed", {
            vpcDetails, subnetNamePrefix: "app", image: testImage, command: ["node"],
            cluster: createTestCluster(), minCapacity: 2, maxCapacity: 2
        }).provision();

        await test("creates no scalable target, scaling policies or alarm", async () =>
        {
            await settleResources();
            Assert.strictEqual(findResource(targetType, "wrk-fixed-ast"), null);
            Assert.strictEqual(findResource(policyType, "wrk-fixed-asp"), null);
            Assert.strictEqual(findResource(policyType, "wrk-fixed-asp-step"), null);
            Assert.strictEqual(findResource(alarmType, "wrk-fixed-asp-step-alm"), null);
        });
    });

    await describe("autoscaled worker on a spot cluster", async () =>
    {
        await test("is rejected before any scaling resources are created", async () =>
        {
            await Assert.rejects(() => new WorkerAppProvisioner("wrk-spot", {
                vpcDetails, subnetNamePrefix: "app", image: testImage, command: ["node"],
                cluster: { ...createTestCluster(), usesSpotInstances: true }, minCapacity: 1, maxCapacity: 3
            }).provision(), /spot instances/);
            await settleResources();
            Assert.strictEqual(findResource(policyType, "wrk-spot-asp-step"), null);
            Assert.strictEqual(findResource(alarmType, "wrk-spot-asp-step-alm"), null);
        });
    });
});
