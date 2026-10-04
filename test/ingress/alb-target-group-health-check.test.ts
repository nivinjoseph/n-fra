import * as Assert from "assert";
import test, { describe } from "node:test";
import { createTestVpcDetails, initializePulumiMocks, waitForResource } from "../app/app-test-harness.js";
import { AlbProvisioner } from "../../src/ingress/alb/alb-provisioner.js";
import type { AlbTarget } from "../../src/ingress/alb/alb-target.js";


await initializePulumiMocks();
const vpcDetails = createTestVpcDetails();
const targetGroupType = "aws:lb/targetGroup:TargetGroup";

function provisionAlb(name: string, targets: Array<AlbTarget>): void
{
    new AlbProvisioner(name, {
        vpcDetails, subnetNamePrefix: "ingress", egressSubnetNamePrefixes: ["app"], targets
    }).provision();
}

async function getHealthCheck(targetGroupName: string): Promise<Record<string, unknown>>
{
    const targetGroup = await waitForResource(targetGroupType, targetGroupName);
    return targetGroup.inputs["healthCheck"] as Record<string, unknown>;
}

await describe("Alb target group health check", async () =>
{
    await test("default host without overrides tolerates ~100s of slow checks and re-admits after 2 passes", async () =>
    {
        provisionAlb("alb-hc-d", [{ host: "default", healthCheckPath: "/health" }]);
        Assert.deepStrictEqual(await getHealthCheck("alb-hc-d-tg-d"),
            { path: "/health", timeout: 10, interval: 20, unhealthyThreshold: 5, healthyThreshold: 2 });
    });

    await test("named host overrides timeout and both thresholds; interval follows the timeout", async () =>
    {
        provisionAlb("alb-hc-n", [{
            host: "one.example.com", healthCheckPath: "/ping",
            healthCheckTimeout: 30, healthCheckUnhealthyThreshold: 8, healthCheckHealthyThreshold: 3
        }]);
        Assert.deepStrictEqual(await getHealthCheck("alb-hc-n-tg-0"),
            { path: "/ping", timeout: 30, interval: 60, unhealthyThreshold: 8, healthyThreshold: 3 });
    });

    await test("default and named hosts build the same health check from the same target settings", async () =>
    {
        provisionAlb("alb-same-d", [{ host: "default", healthCheckPath: "/health", healthCheckTimeout: 15 }]);
        provisionAlb("alb-same-n", [{ host: "two.example.com", healthCheckPath: "/health", healthCheckTimeout: 15 }]);
        Assert.deepStrictEqual(await getHealthCheck("alb-same-d-tg-d"), await getHealthCheck("alb-same-n-tg-0"));
    });

    await test("timeout below 5s is clamped to 5s as before", async () =>
    {
        provisionAlb("alb-hc-clamp", [{ host: "default", healthCheckPath: "/health", healthCheckTimeout: 1 }]);
        const healthCheck = await getHealthCheck("alb-hc-clamp-tg-d");
        Assert.strictEqual(healthCheck["timeout"], 5);
        Assert.strictEqual(healthCheck["interval"], 10);
    });

    await test("thresholds outside the ALB range of 2-10 are rejected", () =>
    {
        const base = { vpcDetails, subnetNamePrefix: "ingress", egressSubnetNamePrefixes: ["app"] };
        Assert.throws(() => new AlbProvisioner("alb-bad-1", { ...base, targets: [{ host: "default", healthCheckPath: "/health", healthCheckUnhealthyThreshold: 1 }] }));
        Assert.throws(() => new AlbProvisioner("alb-bad-2", { ...base, targets: [{ host: "default", healthCheckPath: "/health", healthCheckUnhealthyThreshold: 11 }] }));
        Assert.throws(() => new AlbProvisioner("alb-bad-3", { ...base, targets: [{ host: "default", healthCheckPath: "/health", healthCheckHealthyThreshold: 1 }] }));
        Assert.throws(() => new AlbProvisioner("alb-bad-4", { ...base, targets: [{ host: "default", healthCheckPath: "/health", healthCheckHealthyThreshold: 11 }] }));
    });

    await test("slowStart outside 30-900 is rejected and in-range values are accepted", () =>
    {
        const base = { vpcDetails, subnetNamePrefix: "ingress", egressSubnetNamePrefixes: ["app"] };
        Assert.throws(() => new AlbProvisioner("alb-ss-1", { ...base, targets: [{ host: "default", healthCheckPath: "/health", slowStart: 29 }] }));
        Assert.throws(() => new AlbProvisioner("alb-ss-2", { ...base, targets: [{ host: "default", healthCheckPath: "/health", slowStart: 901 }] }));
        Assert.doesNotThrow(() => new AlbProvisioner("alb-ss-3", { ...base, targets: [{ host: "default", healthCheckPath: "/health", slowStart: 30 }] }));
        Assert.doesNotThrow(() => new AlbProvisioner("alb-ss-4", { ...base, targets: [{ host: "default", healthCheckPath: "/health", healthCheckUnhealthyThreshold: 2, healthCheckHealthyThreshold: 10 }] }));
    });
});
