import * as Assert from "assert";
import test, { describe } from "node:test";
import { createTestCluster, createTestVpcDetails, initializePulumiMocks, testImage, waitForResource } from "./app-test-harness.js";
import { WorkerAppProvisioner } from "../../src/app/worker/worker-app-provisioner.js";
import { GrpcAppProvisioner } from "../../src/app/grpc/grpc-app-provisioner.js";
import { HttpAppProvisioner } from "../../src/app/http/http-app-provisioner.js";


await initializePulumiMocks();
const vpcDetails = createTestVpcDetails();
const ecsServiceType = "aws:ecs/service:Service";

async function getDeploymentPercents(appName: string): Promise<{ minimumHealthy: number; maximum: number; }>
{
    const service = await waitForResource(ecsServiceType, `${appName}-svc`);
    return {
        minimumHealthy: service.inputs["deploymentMinimumHealthyPercent"],
        maximum: service.inputs["deploymentMaximumPercent"]
    };
}

await describe("Service deployment configuration", async () =>
{
    await test("autoscaled worker keeps stop-then-start (0 / 100): worker deployment configuration is unchanged", async () =>
    {
        await new WorkerAppProvisioner("wrk-as", {
            vpcDetails, subnetNamePrefix: "app", image: testImage, command: ["node"],
            cluster: createTestCluster(), minCapacity: 1, maxCapacity: 3
        }).provision();
        Assert.deepStrictEqual(await getDeploymentPercents("wrk-as"), { minimumHealthy: 0, maximum: 100 });
    });

    await test("fixed capacity worker keeps stop-then-start (0 / 100)", async () =>
    {
        await new WorkerAppProvisioner("wrk-fixed", {
            vpcDetails, subnetNamePrefix: "app", image: testImage, command: ["node"],
            cluster: createTestCluster(), minCapacity: 1, maxCapacity: 1
        }).provision();
        Assert.deepStrictEqual(await getDeploymentPercents("wrk-fixed"), { minimumHealthy: 0, maximum: 100 });
    });

    await test("autoscaled grpc app deploys replacement-first (100 / 200)", async () =>
    {
        await new GrpcAppProvisioner("grpc-as", {
            vpcDetails, subnetNamePrefix: "app", ingressSubnetNamePrefixes: ["ingress"], image: testImage, command: ["node"],
            cluster: createTestCluster(), minCapacity: 1, maxCapacity: 3
        }).provision();
        Assert.deepStrictEqual(await getDeploymentPercents("grpc-as"), { minimumHealthy: 100, maximum: 200 });
    });

    await test("fixed capacity grpc app keeps stop-then-start (0 / 100)", async () =>
    {
        await new GrpcAppProvisioner("grpc-fixed", {
            vpcDetails, subnetNamePrefix: "app", ingressSubnetNamePrefixes: ["ingress"], image: testImage, command: ["node"],
            cluster: createTestCluster(), minCapacity: 2, maxCapacity: 2
        }).provision();
        Assert.deepStrictEqual(await getDeploymentPercents("grpc-fixed"), { minimumHealthy: 0, maximum: 100 });
    });

    await test("grpc app that is off (min = max = 0) is not autoscaled (0 / 100)", async () =>
    {
        await new GrpcAppProvisioner("grpc-off", {
            vpcDetails, subnetNamePrefix: "app", ingressSubnetNamePrefixes: ["ingress"], image: testImage, command: ["node"],
            cluster: createTestCluster(), minCapacity: 1, maxCapacity: 3, isOn: false
        }).provision();
        Assert.deepStrictEqual(await getDeploymentPercents("grpc-off"), { minimumHealthy: 0, maximum: 100 });
        const service = await waitForResource(ecsServiceType, "grpc-off-svc");
        Assert.strictEqual(service.inputs["desiredCount"], 0);
    });

    await test("autoscaled http app deploys replacement-first (100 / 200)", async () =>
    {
        await new HttpAppProvisioner("http-as", {
            vpcDetails, subnetNamePrefix: "app", ingressSubnetNamePrefixes: ["ingress"], image: testImage, command: ["node"],
            cluster: createTestCluster(), minCapacity: 1, maxCapacity: 3
        }).provision();
        Assert.deepStrictEqual(await getDeploymentPercents("http-as"), { minimumHealthy: 100, maximum: 200 });
    });
});
