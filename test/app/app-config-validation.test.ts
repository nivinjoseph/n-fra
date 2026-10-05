import * as Assert from "assert";
import test, { describe } from "node:test";
import * as Pulumi from "@pulumi/pulumi";
import { createTestCluster, createTestVpcDetails, initializePulumiMocks, testImage } from "./app-test-harness.js";
import { HttpAppProvisioner } from "../../src/app/http/http-app-provisioner.js";
import type { AppComputeProfile } from "../../src/app/app-compute-profile.js";


await initializePulumiMocks();
const vpcDetails = createTestVpcDetails();
const baseConfig = {
    vpcDetails, subnetNamePrefix: "app", ingressSubnetNamePrefixes: ["ingress"], image: testImage, command: ["node"],
    cluster: createTestCluster()
};
const targetGroupArn = "arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/http-tg/0123456789abcdef";

await describe("App config validation at construction", async () =>
{
    await test("accepts a plain string ALB target group ARN, matching its declared Input<string> type", () =>
    {
        Assert.doesNotThrow(() => new HttpAppProvisioner("http-arn-str", { ...baseConfig, albTargetGroupArn: targetGroupArn }));
    });

    await test("accepts a Pulumi Output ALB target group ARN", () =>
    {
        Assert.doesNotThrow(() => new HttpAppProvisioner("http-arn-out", { ...baseConfig, albTargetGroupArn: Pulumi.output(targetGroupArn) }));
    });

    await test("accepts a Promise ALB target group ARN, since Pulumi.Input<string> includes promises", () =>
    {
        Assert.doesNotThrow(() => new HttpAppProvisioner("http-arn-promise", { ...baseConfig, albTargetGroupArn: Promise.resolve(targetGroupArn) }));
    });

    await test("falls back to the defaults when optional fields are passed as undefined", () =>
    {
        Assert.doesNotThrow(() => new HttpAppProvisioner("http-undefined-defaults", {
            ...baseConfig, computeProfile: undefined, minCapacity: undefined, maxCapacity: undefined, isOn: undefined
        }));
    });

    await test("rejects an unknown computeProfile before provisioning", () =>
    {
        Assert.throws(() => new HttpAppProvisioner("http-bad-profile", { ...baseConfig, computeProfile: 999 as AppComputeProfile }), /computeProfile/);
    });

    await test("rejects autoscaling on a spot cluster before provisioning", () =>
    {
        const spotCluster = { ...createTestCluster(), usesSpotInstances: true };
        Assert.throws(() => new HttpAppProvisioner("http-spot-as", { ...baseConfig, cluster: spotCluster, minCapacity: 1, maxCapacity: 3 }), /spot/);
    });

    await test("accepts fixed capacity on a spot cluster", () =>
    {
        const spotCluster = { ...createTestCluster(), usesSpotInstances: true };
        Assert.doesNotThrow(() => new HttpAppProvisioner("http-spot-fixed", { ...baseConfig, cluster: spotCluster, minCapacity: 2, maxCapacity: 2 }));
    });
});
