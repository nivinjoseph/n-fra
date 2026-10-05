import * as Assert from "assert";
import test, { describe } from "node:test";
import { VpcAz, type AlbTarget, type AppClusterDetails, type HttpAppConfig, type PostgresInstanceConfig, type SubnetNamePrefix, type VpcDetails } from "../src/index.js";


// These values are never provisioned; the test exists so that `tsc` enforces the rules the config types encode.
const vpcDetails = null as unknown as VpcDetails;
const cluster = null as unknown as AppClusterDetails;
const appBase = { vpcDetails, subnetNamePrefix: "private-app", ingressSubnetNamePrefixes: ["public-ingress"], image: "my-app:v1.0.0" };
const dbBase = {
    vpcDetails, subnetNamePrefix: "isolated-db", ingressSubnetNamePrefixes: ["private-app"],
    instanceClass: "db.t4g.micro" as const, storageGb: 20, maxStorageGb: 100
};

await describe("config types carry the mutual-exclusion rules", async () =>
{
    await test("each @ts-expect-error below must remain a compile error", () =>
    {
        const withCluster: HttpAppConfig = { ...appBase, command: ["node"], cluster };
        const withClusterConfig: HttpAppConfig = { ...appBase, entryPoint: ["node"], clusterConfig: {} };
        const withDockerfile: HttpAppConfig = { ...appBase, useDockerfileCommandOrEntryPoint: true, cluster };
        // @ts-expect-error cluster and clusterConfig are mutually exclusive
        const bothClusters: HttpAppConfig = { ...appBase, command: ["node"], cluster, clusterConfig: {} };
        // @ts-expect-error command and entryPoint are mutually exclusive
        const bothLaunch: HttpAppConfig = { ...appBase, cluster, command: ["node"], entryPoint: ["node"] };
        // @ts-expect-error one of command, entryPoint or useDockerfileCommandOrEntryPoint is required
        const noLaunch: HttpAppConfig = { ...appBase, cluster };
        const fromName: PostgresInstanceConfig = { ...dbBase, databaseName: "app" };
        const fromSnapshot: PostgresInstanceConfig = { ...dbBase, restoreSnapshotId: "snap-1", availabilityZone: VpcAz.b };
        // @ts-expect-error databaseName and restoreSnapshotId are mutually exclusive
        const bothSources: PostgresInstanceConfig = { ...dbBase, databaseName: "app", restoreSnapshotId: "snap-1" };
        // @ts-expect-error availabilityZone is the zone letter (VpcAz), not the full zone name
        const fullZone: PostgresInstanceConfig = { ...dbBase, databaseName: "app", availabilityZone: "us-east-1b" };
        // @ts-expect-error instanceClass must be an RDS class such as db.t4g.micro
        const badClass: PostgresInstanceConfig = { ...dbBase, databaseName: "app", instanceClass: "huge" };
        const newerClass: PostgresInstanceConfig = { ...dbBase, databaseName: "app", instanceClass: "db.m8g.large" };
        // @ts-expect-error sidecarConfig was removed; sidecars were never implemented
        const withSidecar: HttpAppConfig = { ...appBase, command: ["node"], cluster, sidecarConfig: {} };
        const defaultHost: AlbTarget["host"] = "default";
        const namedHost: AlbTarget["host"] = "api.example.com";
        const prefix: SubnetNamePrefix = "private-app";
        Assert.strictEqual([withCluster, withClusterConfig, withDockerfile, bothClusters, bothLaunch, noLaunch, fromName, fromSnapshot, bothSources, fullZone, badClass, newerClass, withSidecar].length, 13);
        Assert.deepStrictEqual([defaultHost, namedHost, prefix], ["default", "api.example.com", "private-app"]);
    });
});
