import * as Assert from "assert";
import test, { describe } from "node:test";
import * as Pulumi from "@pulumi/pulumi";
import { createTestVpcDetails, initializePulumiMocks } from "../app/app-test-harness.js";
import { Aspv2Provisioner } from "../../src/database/aurora-serverless-postgres-v2/aspv2-provisioner.js";


await initializePulumiMocks();
const vpcDetails = createTestVpcDetails();
const baseConfig = {
    vpcDetails, subnetNamePrefix: "app", ingressSubnetNamePrefixes: ["app"],
    minCapacity: 0.5, maxCapacity: 2, deletionProtection: false, skipFinalSnapshot: true
};

await describe("Aurora serverless v2 config validation", async () =>
{
    await test("accepts a Pulumi Output as restoreSnapshotId, matching its declared Input<string> type", () =>
    {
        Assert.doesNotThrow(() => new Aspv2Provisioner("aspv2-snap-out", { ...baseConfig, restoreSnapshotId: Pulumi.output("snap-1") }));
    });
});
