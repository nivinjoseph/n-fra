import * as Assert from "assert";
import test, { describe } from "node:test";
import { createTestCluster, createTestVpcDetails, initializePulumiMocks, testImage, waitForResource } from "./app-test-harness.js";
import { GrpcAppProvisioner } from "../../src/app/grpc/grpc-app-provisioner.js";


await initializePulumiMocks();
const vpcDetails = createTestVpcDetails();
const taskDefinitionType = "aws:ecs/taskDefinition:TaskDefinition";

interface ContainerHealthCheck
{
    command: Array<string>;
    interval: number;
    timeout: number;
    retries: number;
    startPeriod: number;
}

async function getAppContainerHealthCheck(appName: string): Promise<ContainerHealthCheck>
{
    const taskDefinition = await waitForResource(taskDefinitionType, `${appName}-tsk-def`);
    const containers = JSON.parse(taskDefinition.inputs["containerDefinitions"] as string) as Array<Record<string, unknown>>;
    const appContainer = containers.find(t => t["name"] === appName)!;
    return appContainer["healthCheck"] as ContainerHealthCheck;
}

const probeCommandPattern = /^\/usr\/local\/bin\/grpc-health-probe -addr=:50051 -service=grpc\.health\.v1\.Health -connect-timeout=(\d+)s -rpc-timeout=(\d+)s$/;

await describe("Grpc app container health check", async () =>
{
    await new GrpcAppProvisioner("grpc-hc", {
        vpcDetails, subnetNamePrefix: "app", ingressSubnetNamePrefixes: ["ingress"], image: testImage, command: ["node"],
        cluster: createTestCluster()
    }).provision();

    await test("probes grpc.health.v1.Health on the grpc port with explicit connect and rpc timeouts", async () =>
    {
        const healthCheck = await getAppContainerHealthCheck("grpc-hc");
        Assert.strictEqual(healthCheck.command[0], "CMD-SHELL");
        Assert.match(healthCheck.command[1], probeCommandPattern);
    });

    await test("probe budget (connect + rpc) completes before the ECS health check timeout", async () =>
    {
        const healthCheck = await getAppContainerHealthCheck("grpc-hc");
        const [, connect, rpc] = probeCommandPattern.exec(healthCheck.command[1])!;
        const probeBudget = Number(connect) + Number(rpc);
        Assert.ok(probeBudget < healthCheck.timeout,
            `probe budget ${probeBudget}s must be less than the ECS health check timeout ${healthCheck.timeout}s`);
    });

    await test("is liveness-grade: 30s interval, 30s timeout, 10 retries, 60s start period", async () =>
    {
        const healthCheck = await getAppContainerHealthCheck("grpc-hc");
        Assert.strictEqual(healthCheck.interval, 30);
        Assert.strictEqual(healthCheck.timeout, 30);
        Assert.strictEqual(healthCheck.retries, 10);
        Assert.strictEqual(healthCheck.startPeriod, 60);
    });
});
