import * as Assert from "assert";
import test, { describe } from "node:test";
import { createTestCluster, createTestVpcDetails, initializePulumiMocks, testImage, waitForResource } from "./app-test-harness.js";
import { HttpAppProvisioner } from "../../src/app/http/http-app-provisioner.js";


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

const probeCommandPattern = /^curl -f --max-time (\d+) http:\/\/localhost:80\/healthCheck \|\| exit 1$/;

await describe("Http app container health check", async () =>
{
    await new HttpAppProvisioner("http-hc", {
        vpcDetails, subnetNamePrefix: "app", ingressSubnetNamePrefixes: ["ingress"], image: testImage, command: ["node"],
        cluster: createTestCluster()
    }).provision();

    await test("curls /healthCheck on the http port with an explicit --max-time budget", async () =>
    {
        const healthCheck = await getAppContainerHealthCheck("http-hc");
        Assert.strictEqual(healthCheck.command[0], "CMD-SHELL");
        Assert.match(healthCheck.command[1], probeCommandPattern);
    });

    await test("curl budget completes before the ECS health check timeout", async () =>
    {
        const healthCheck = await getAppContainerHealthCheck("http-hc");
        const match = probeCommandPattern.exec(healthCheck.command[1]);
        Assert.ok(match, `probe command must carry --max-time: ${healthCheck.command[1]}`);
        const probeBudget = Number(match[1]);
        Assert.ok(probeBudget < healthCheck.timeout,
            `probe budget ${probeBudget}s must be less than the ECS health check timeout ${healthCheck.timeout}s`);
    });

    await test("is liveness-grade: 30s interval, 30s timeout, 10 retries, 60s start period", async () =>
    {
        const healthCheck = await getAppContainerHealthCheck("http-hc");
        Assert.strictEqual(healthCheck.interval, 30);
        Assert.strictEqual(healthCheck.timeout, 30);
        Assert.strictEqual(healthCheck.retries, 10);
        Assert.strictEqual(healthCheck.startPeriod, 60);
    });
});
