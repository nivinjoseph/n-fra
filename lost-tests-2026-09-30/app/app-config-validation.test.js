import * as Assert from "assert";
import test, { describe } from "node:test";
import * as Pulumi from "@pulumi/pulumi";
import { createTestCluster, createTestDatadogConfig, createTestVpcDetails, initializePulumiMocks, testImage } from "./app-test-harness.js";
import { HttpAppProvisioner } from "../../src/app/http/http-app-provisioner.js";
import { GrpcAppProvisioner } from "../../src/app/grpc/grpc-app-provisioner.js";
import { WorkerAppProvisioner } from "../../src/app/worker/worker-app-provisioner.js";
await initializePulumiMocks();
const vpcDetails = createTestVpcDetails();
function createHttpConfig(overrides) {
    return {
        vpcDetails, subnetNamePrefix: "app", ingressSubnetNamePrefixes: ["ingress"], image: testImage, command: ["node"],
        cluster: createTestCluster(), minCapacity: 1, maxCapacity: 3,
        ...overrides
    };
}
await describe("Http app ALB suffix validation", async () => {
    await test("accepts albTargetGroupArn together with both suffixes", () => {
        Assert.doesNotThrow(() => new HttpAppProvisioner("http-ok", createHttpConfig({
            albTargetGroupArn: Pulumi.output("arn:tg"),
            albArnSuffix: Pulumi.output("app/x/1"),
            albTargetGroupArnSuffix: Pulumi.output("targetgroup/y/2")
        })));
    });
    await test("rejects albArnSuffix without albTargetGroupArnSuffix", () => {
        Assert.throws(() => new HttpAppProvisioner("http-bad1", createHttpConfig({
            albTargetGroupArn: Pulumi.output("arn:tg"),
            albArnSuffix: Pulumi.output("app/x/1")
        })), /albArnSuffix and albTargetGroupArnSuffix must be provided together/);
    });
    await test("rejects albTargetGroupArnSuffix without albArnSuffix", () => {
        Assert.throws(() => new HttpAppProvisioner("http-bad2", createHttpConfig({
            albTargetGroupArn: Pulumi.output("arn:tg"),
            albTargetGroupArnSuffix: Pulumi.output("targetgroup/y/2")
        })), /albArnSuffix and albTargetGroupArnSuffix must be provided together/);
    });
    await test("rejects suffixes without albTargetGroupArn", () => {
        Assert.throws(() => new HttpAppProvisioner("http-bad3", createHttpConfig({
            albArnSuffix: Pulumi.output("app/x/1"),
            albTargetGroupArnSuffix: Pulumi.output("targetgroup/y/2")
        })), /albArnSuffix and albTargetGroupArnSuffix require albTargetGroupArn/);
    });
});
await describe("Auto scaling validation", async () => {
    const autoScalingCases = [
        { name: "accepts an empty autoScaling block", autoScaling: {} },
        { name: "accepts cpuTargetPercent 1", autoScaling: { cpuTargetPercent: 1 } },
        { name: "accepts cpuTargetPercent 100", autoScaling: { cpuTargetPercent: 100 } },
        { name: "rejects cpuTargetPercent 0", autoScaling: { cpuTargetPercent: 0 }, reason: /cpuTargetPercent must be between 1 and 100/ },
        { name: "rejects cpuTargetPercent 101", autoScaling: { cpuTargetPercent: 101 }, reason: /cpuTargetPercent must be between 1 and 100/ },
        { name: "accepts memoryTargetPercent 50", autoScaling: { memoryTargetPercent: 50 } },
        { name: "rejects memoryTargetPercent 0", autoScaling: { memoryTargetPercent: 0 }, reason: /memoryTargetPercent must be between 1 and 100/ },
        { name: "rejects memoryTargetPercent 101", autoScaling: { memoryTargetPercent: 101 }, reason: /memoryTargetPercent must be between 1 and 100/ },
        { name: "rejects requestsPerTarget 0", autoScaling: { requestsPerTarget: 0 }, reason: /requestsPerTarget must be > 0/ },
        { name: "accepts scaleOutCooldownSeconds 0", autoScaling: { scaleOutCooldownSeconds: 0 } },
        { name: "accepts scaleInCooldownSeconds 3600", autoScaling: { scaleInCooldownSeconds: 3600 } },
        { name: "rejects scaleOutCooldownSeconds 3601", autoScaling: { scaleOutCooldownSeconds: 3601 }, reason: /scaleOutCooldownSeconds must be an integer between 0 and 3600/ },
        { name: "rejects negative scaleInCooldownSeconds", autoScaling: { scaleInCooldownSeconds: -1 }, reason: /scaleInCooldownSeconds must be an integer between 0 and 3600/ },
        { name: "rejects fractional scaleInCooldownSeconds", autoScaling: { scaleInCooldownSeconds: 1.5 }, reason: /scaleInCooldownSeconds must be an integer between 0 and 3600/ }
    ];
    for (const testCase of autoScalingCases) {
        await test(testCase.name, () => {
            const create = () => new HttpAppProvisioner("http-asv", createHttpConfig({ autoScaling: testCase.autoScaling }));
            if (testCase.reason == null)
                Assert.doesNotThrow(create);
            else
                Assert.throws(create, testCase.reason);
        });
    }
    await test("accepts an autoScaling block when minCapacity equals maxCapacity", () => {
        Assert.doesNotThrow(() => new HttpAppProvisioner("http-pinned", createHttpConfig({
            minCapacity: 2, maxCapacity: 2, autoScaling: { cpuTargetPercent: 50 }
        })));
    });
    await test("accepts an autoScaling block when the app is off", () => {
        Assert.doesNotThrow(() => new HttpAppProvisioner("http-off", createHttpConfig({
            isOn: false, autoScaling: { cpuTargetPercent: 50 }
        })));
    });
    await test("http app rejects requestsPerTarget without the target group and suffixes", () => {
        Assert.throws(() => new HttpAppProvisioner("http-req-bad", createHttpConfig({
            autoScaling: { requestsPerTarget: 100 }
        })), /requestsPerTarget requires albTargetGroupArn, albArnSuffix and albTargetGroupArnSuffix/);
    });
    await test("http app accepts requestsPerTarget with the target group and suffixes", () => {
        Assert.doesNotThrow(() => new HttpAppProvisioner("http-req-ok", createHttpConfig({
            albTargetGroupArn: Pulumi.output("arn:tg"),
            albArnSuffix: Pulumi.output("app/x/1"),
            albTargetGroupArnSuffix: Pulumi.output("targetgroup/y/2"),
            autoScaling: { requestsPerTarget: 100 }
        })));
    });
    await test("grpc app rejects requestsPerTarget", () => {
        Assert.throws(() => new GrpcAppProvisioner("grpc-req", {
            vpcDetails, subnetNamePrefix: "app", ingressSubnetNamePrefixes: ["ingress"], image: testImage, command: ["node"],
            cluster: createTestCluster(), minCapacity: 1, maxCapacity: 3, autoScaling: { requestsPerTarget: 100 }
        }), /requestsPerTarget is only supported by http apps/);
    });
    await test("worker app rejects requestsPerTarget", () => {
        Assert.throws(() => new WorkerAppProvisioner("wrk-req", {
            vpcDetails, subnetNamePrefix: "app", image: testImage, command: ["node"],
            cluster: createTestCluster(), minCapacity: 1, maxCapacity: 3, autoScaling: { requestsPerTarget: 100 }
        }), /requestsPerTarget is only supported by http apps/);
    });
});
await describe("Datadog agentImageTag validation", async () => {
    const reason = /datadogConfig.agentImageTag must be a bare, pinned tag/;
    await test("accepts a bare pinned tag", () => {
        Assert.doesNotThrow(() => new HttpAppProvisioner("dd-ok", createHttpConfig({
            datadogConfig: { ...createTestDatadogConfig(), agentImageTag: "7.80.0" }
        })));
    });
    await test("rejects a tag that includes a registry or repository", () => {
        Assert.throws(() => new HttpAppProvisioner("dd-bad1", createHttpConfig({
            datadogConfig: { ...createTestDatadogConfig(), agentImageTag: "datadog/agent:7.80.0" }
        })), reason);
    });
    await test("rejects latest", () => {
        Assert.throws(() => new HttpAppProvisioner("dd-bad2", createHttpConfig({
            datadogConfig: { ...createTestDatadogConfig(), agentImageTag: "latest" }
        })), reason);
    });
    await test("rejects a tag with surrounding whitespace", () => {
        Assert.throws(() => new HttpAppProvisioner("dd-bad4", createHttpConfig({
            datadogConfig: { ...createTestDatadogConfig(), agentImageTag: " 7.83.3" }
        })), reason);
    });
    await test("rejects a blank tag", () => {
        Assert.throws(() => new HttpAppProvisioner("dd-bad3", createHttpConfig({
            datadogConfig: { ...createTestDatadogConfig(), agentImageTag: "  " }
        })), reason);
    });
});
//# sourceMappingURL=app-config-validation.test.js.map