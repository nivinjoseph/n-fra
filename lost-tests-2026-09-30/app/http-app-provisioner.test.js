import * as Assert from "assert";
import test, { describe } from "node:test";
import * as Pulumi from "@pulumi/pulumi";
import { createTestCluster, createTestDatadogConfig, createTestVpcDetails, findResource, initializePulumiMocks, settleResources, testImage, waitForResource } from "./app-test-harness.js";
import { HttpAppProvisioner } from "../../src/app/http/http-app-provisioner.js";
await initializePulumiMocks();
const vpcDetails = createTestVpcDetails();
const policyType = "aws:appautoscaling/policy:Policy";
const targetType = "aws:appautoscaling/target:Target";
const taskDefinitionType = "aws:ecs/taskDefinition:TaskDefinition";
async function getContainerDefinitions(appName) {
    const taskDefinition = await waitForResource(taskDefinitionType, `${appName}-tsk-def`);
    const containers = JSON.parse(taskDefinition.inputs["containerDefinitions"]);
    return Object.fromEntries(containers.map(t => [t["name"], t]));
}
await describe("Http app provisioner", async () => {
    await describe("with datadog, memory and request autoscaling", async () => {
        await new HttpAppProvisioner("http-full", {
            vpcDetails, subnetNamePrefix: "app", ingressSubnetNamePrefixes: ["ingress"], image: testImage, command: ["node"],
            cluster: createTestCluster(), minCapacity: 1, maxCapacity: 4,
            datadogConfig: createTestDatadogConfig(),
            albTargetGroupArn: Pulumi.output("arn:aws:elasticloadbalancing:mock:targetgroup/y/2"),
            albArnSuffix: Pulumi.output("app/x/1"),
            albTargetGroupArnSuffix: Pulumi.output("targetgroup/y/2"),
            autoScaling: { memoryTargetPercent: 70, requestsPerTarget: 500 }
        }).provision();
        await test("registers a scalable target for the service desired count", async () => {
            const target = await waitForResource(targetType, "http-full-ast");
            Assert.strictEqual(target.inputs["minCapacity"], 1);
            Assert.strictEqual(target.inputs["maxCapacity"], 4);
            Assert.strictEqual(target.inputs["scalableDimension"], "ecs:service:DesiredCount");
        });
        await test("keeps the cpu policy under its existing name with the default target and cooldowns", async () => {
            const policy = await waitForResource(policyType, "http-full-asp");
            const configuration = policy.inputs["targetTrackingScalingPolicyConfiguration"];
            Assert.strictEqual(configuration.targetValue, 60);
            Assert.strictEqual(configuration.scaleInCooldown, 300);
            Assert.strictEqual(configuration.scaleOutCooldown, 60);
            Assert.strictEqual(configuration.predefinedMetricSpecification.predefinedMetricType, "ECSServiceAverageCPUUtilization");
        });
        await test("adds a memory policy", async () => {
            const policy = await waitForResource(policyType, "http-full-asp-mem");
            const configuration = policy.inputs["targetTrackingScalingPolicyConfiguration"];
            Assert.strictEqual(configuration.targetValue, 70);
            Assert.strictEqual(configuration.predefinedMetricSpecification.predefinedMetricType, "ECSServiceAverageMemoryUtilization");
        });
        await test("adds a request count policy labelled with the alb and target group suffixes", async () => {
            const policy = await waitForResource(policyType, "http-full-asp-req");
            const configuration = policy.inputs["targetTrackingScalingPolicyConfiguration"];
            Assert.strictEqual(configuration.targetValue, 500);
            Assert.strictEqual(configuration.predefinedMetricSpecification.predefinedMetricType, "ALBRequestCountPerTarget");
            Assert.strictEqual(configuration.predefinedMetricSpecification.resourceLabel, "app/x/1/targetgroup/y/2");
        });
        await test("datadog agent sidecar is not essential", async () => {
            const containers = await getContainerDefinitions("http-full");
            Assert.strictEqual(containers["datadog-agent"].essential, false);
        });
        await test("log router sidecar stays essential", async () => {
            const containers = await getContainerDefinitions("http-full");
            Assert.strictEqual(containers["log_router"].essential, true);
        });
        await test("datadog agent runs the pinned GA image without the jmx variant", async () => {
            const containers = await getContainerDefinitions("http-full");
            Assert.strictEqual(containers["datadog-agent"].image, "public.ecr.aws/datadog/agent:7.83.3");
        });
        await test("app container reserves the task cpu left after the datadog sidecars", async () => {
            const taskDefinition = await waitForResource(taskDefinitionType, "http-full-tsk-def");
            Assert.strictEqual(taskDefinition.inputs["cpu"], "512");
            Assert.strictEqual(taskDefinition.inputs["memory"], "1024");
            const containers = await getContainerDefinitions("http-full");
            Assert.strictEqual(containers["datadog-agent"].cpu, 30);
            Assert.strictEqual(containers["log_router"].cpu, 10);
            Assert.strictEqual(containers["http-full"].cpu, 512 - 30 - 10);
        });
    });
    await describe("with xray", async () => {
        await new HttpAppProvisioner("http-xray", {
            vpcDetails, subnetNamePrefix: "app", ingressSubnetNamePrefixes: ["ingress"], image: testImage, command: ["node"],
            cluster: createTestCluster(), enableXray: true
        }).provision();
        await test("app container reserves the task cpu left after the otel collector", async () => {
            const containers = await getContainerDefinitions("http-xray");
            Assert.strictEqual(containers["xray"].cpu, 30);
            Assert.strictEqual(containers["http-xray"].cpu, 512 - 30);
        });
    });
    await describe("with a datadog agentImageTag override", async () => {
        await new HttpAppProvisioner("http-ddtag", {
            vpcDetails, subnetNamePrefix: "app", ingressSubnetNamePrefixes: ["ingress"], image: testImage, command: ["node"],
            cluster: createTestCluster(),
            datadogConfig: { ...createTestDatadogConfig(), agentImageTag: "7.80.0" }
        }).provision();
        await test("runs the requested agent tag", async () => {
            const containers = await getContainerDefinitions("http-ddtag");
            Assert.strictEqual(containers["datadog-agent"].image, "public.ecr.aws/datadog/agent:7.80.0");
        });
    });
    await describe("with custom cpu target and cooldowns", async () => {
        await new HttpAppProvisioner("http-cpu", {
            vpcDetails, subnetNamePrefix: "app", ingressSubnetNamePrefixes: ["ingress"], image: testImage, command: ["node"],
            cluster: createTestCluster(), minCapacity: 1, maxCapacity: 4,
            autoScaling: { cpuTargetPercent: 45, scaleOutCooldownSeconds: 30, scaleInCooldownSeconds: 120 }
        }).provision();
        await test("applies the overrides to the cpu policy", async () => {
            const policy = await waitForResource(policyType, "http-cpu-asp");
            const configuration = policy.inputs["targetTrackingScalingPolicyConfiguration"];
            Assert.strictEqual(configuration.targetValue, 45);
            Assert.strictEqual(configuration.scaleInCooldown, 120);
            Assert.strictEqual(configuration.scaleOutCooldown, 30);
        });
    });
    await describe("without an autoScaling block", async () => {
        await new HttpAppProvisioner("http-plain", {
            vpcDetails, subnetNamePrefix: "app", ingressSubnetNamePrefixes: ["ingress"], image: testImage, command: ["node"],
            cluster: createTestCluster(), minCapacity: 1, maxCapacity: 4
        }).provision();
        await test("creates only the cpu policy with today's defaults", async () => {
            const policy = await waitForResource(policyType, "http-plain-asp");
            const configuration = policy.inputs["targetTrackingScalingPolicyConfiguration"];
            Assert.strictEqual(configuration.targetValue, 60);
            Assert.strictEqual(configuration.scaleInCooldown, 300);
            Assert.strictEqual(configuration.scaleOutCooldown, 60);
            await settleResources();
            Assert.strictEqual(findResource(policyType, "http-plain-asp-mem"), null);
            Assert.strictEqual(findResource(policyType, "http-plain-asp-req"), null);
        });
        await test("app container reserves the whole task cpu when there are no sidecars", async () => {
            const containers = await getContainerDefinitions("http-plain");
            Assert.strictEqual(containers["http-plain"].cpu, 512);
        });
    });
});
//# sourceMappingURL=http-app-provisioner.test.js.map