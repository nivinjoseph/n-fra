import * as Assert from "assert";
import test, { describe } from "node:test";
import * as Pulumi from "@pulumi/pulumi";
import { createTestVpcDetails, initializePulumiMocks, waitForResource } from "../app/app-test-harness.js";
import { VpcAz } from "../../src/vpc/vpc-az.js";
import type { PostgresInstanceConfig } from "../../src/database/postgres-instance/postgres-instance-config.js";
import { PostgresInstanceProvisioner } from "../../src/database/postgres-instance/postgres-instance-provisioner.js";
import { MariaInstanceProvisioner } from "../../src/database/maria-instance/maria-instance-provisioner.js";


await initializePulumiMocks();
const vpcDetails = createTestVpcDetails();
const baseConfig = {
    vpcDetails, subnetNamePrefix: "app", ingressSubnetNamePrefixes: ["app"],
    instanceClass: "db.t4g.micro" as const, storageGb: 20, maxStorageGb: 100
};

await describe("Postgres instance config validation", async () =>
{
    await test("accepts a Pulumi Output as restoreSnapshotId, matching its declared Input<string> type", () =>
    {
        Assert.doesNotThrow(() => new PostgresInstanceProvisioner("pg-snap-out", { ...baseConfig, restoreSnapshotId: Pulumi.output("snap-1") }));
    });

    await test("accepts a Promise as restoreSnapshotId, since Pulumi.Input<string> includes promises", () =>
    {
        Assert.doesNotThrow(() => new PostgresInstanceProvisioner("pg-snap-promise", { ...baseConfig, restoreSnapshotId: Promise.resolve("snap-1") }));
    });

    await test("accepts a plain string as restoreSnapshotId", () =>
    {
        Assert.doesNotThrow(() => new PostgresInstanceProvisioner("pg-snap-str", { ...baseConfig, restoreSnapshotId: "snap-1" }));
    });

    await test("rejects a restoreSnapshotId that is neither a string nor an Output, naming the field", () =>
    {
        Assert.throws(() => new PostgresInstanceProvisioner("pg-snap-bad", { ...baseConfig, restoreSnapshotId: 42 as unknown as string }),
            /restoreSnapshotId/);
    });
});

await describe("Maria instance config validation", async () =>
{
    await test("accepts a Pulumi Output as restoreSnapshotId", () =>
    {
        Assert.doesNotThrow(() => new MariaInstanceProvisioner("maria-snap-out", { ...baseConfig, restoreSnapshotId: Pulumi.output("snap-1") }));
    });
});

await describe("Postgres instance placement and sizing", async () =>
{
    await test("maps the VpcAz letter to the region's full zone name on the RDS instance", async () =>
    {
        new PostgresInstanceProvisioner("pg-az", { ...baseConfig, databaseName: "app", availabilityZone: VpcAz.b }).provision();
        const instance = await waitForResource("aws:rds/instance:Instance", "pg-az-postgres-db-ins");
        Assert.strictEqual(instance.inputs["availabilityZone"], "us-east-1b");
    });

    await test("rejects an instanceClass that is not an RDS class and names the field", () =>
    {
        Assert.throws(() => new PostgresInstanceProvisioner("pg-bad-class", { ...baseConfig, databaseName: "app", instanceClass: "huge" as PostgresInstanceConfig["instanceClass"] }),
            /instanceClass/);
    });
});
