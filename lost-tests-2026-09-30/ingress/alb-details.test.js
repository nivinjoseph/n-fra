import * as Assert from "assert";
import test, { describe } from "node:test";
import { createTestVpcDetails, initializePulumiMocks, resolveOutput } from "../app/app-test-harness.js";
import { AlbProvisioner } from "../../src/ingress/alb/alb-provisioner.js";
await initializePulumiMocks();
const vpcDetails = createTestVpcDetails();
await describe("Alb details", async () => {
    await test("default host target exposes the alb and target group arn suffixes", async () => {
        const details = new AlbProvisioner("alb-d", {
            vpcDetails, subnetNamePrefix: "ingress", egressSubnetNamePrefixes: ["app"],
            targets: [{ host: "default", healthCheckPath: "/health" }]
        }).provision();
        const target = details.hostTargets["default"];
        Assert.strictEqual(await resolveOutput(target.albTargetGroupArn), "arn:aws:mock:alb-d-tg-d");
        Assert.strictEqual(await resolveOutput(target.albArnSuffix), "alb-d-alb-arn-suffix");
        Assert.strictEqual(await resolveOutput(target.albTargetGroupArnSuffix), "alb-d-tg-d-arn-suffix");
    });
    await test("named host targets expose the alb and their own target group arn suffixes", async () => {
        const details = new AlbProvisioner("alb-m", {
            vpcDetails, subnetNamePrefix: "ingress", egressSubnetNamePrefixes: ["app"],
            targets: [
                { host: "one.example.com", healthCheckPath: "/health" },
                { host: "two.example.com", healthCheckPath: "/health" }
            ]
        }).provision();
        const one = details.hostTargets["one.example.com"];
        const two = details.hostTargets["two.example.com"];
        Assert.strictEqual(await resolveOutput(one.albArnSuffix), "alb-m-alb-arn-suffix");
        Assert.strictEqual(await resolveOutput(one.albTargetGroupArnSuffix), "alb-m-tg-0-arn-suffix");
        Assert.strictEqual(await resolveOutput(two.albArnSuffix), "alb-m-alb-arn-suffix");
        Assert.strictEqual(await resolveOutput(two.albTargetGroupArnSuffix), "alb-m-tg-1-arn-suffix");
    });
});
//# sourceMappingURL=alb-details.test.js.map