import * as Assert from "assert";
import test, { describe } from "node:test";
import { createTestCluster, createTestVpcDetails, initializePulumiMocks, testImage, waitForResource } from "./app-test-harness.js";
import { WorkerAppProvisioner } from "../../src/app/worker/worker-app-provisioner.js";
import { GrpcAppProvisioner } from "../../src/app/grpc/grpc-app-provisioner.js";
import { HttpAppProvisioner } from "../../src/app/http/http-app-provisioner.js";
await initializePulumiMocks();
const vpcDetails = createTestVpcDetails();
const ecsServiceType = "aws:ecs/service:Service";
await describe("Service deployment configuration", async () => {
    await test("autoscaled worker deploys with 100 percent minimum healthy and 200 percent maximum", async () => {
        const provisioner = new WorkerAppProvisioner("wrk-as", {
            vpcDetails, subnetNamePrefix: "app", image: testImage, command: ["node"],
            cluster: createTestCluster(), minCapacity: 1, maxCapacity: 3
        });
        await provisioner.provision();
        const service = await waitForResource(ecsServiceType, "wrk-as-svc");
        Assert.strictEqual(service.inputs["deploymentMinimumHealthyPercent"], 100);
        Assert.strictEqual(service.inputs["deploymentMaximumPercent"], 200);
    });
    await test("fixed capacity worker deploys with 0 percent minimum healthy and 100 percent maximum", async () => {
        const provisioner = new WorkerAppProvisioner("wrk-fixed", {
            vpcDetails, subnetNamePrefix: "app", image: testImage, command: ["node"],
            cluster: createTestCluster(), minCapacity: 1, maxCapacity: 1
        });
        await provisioner.provision();
        const service = await waitForResource(ecsServiceType, "wrk-fixed-svc");
        Assert.strictEqual(service.inputs["deploymentMinimumHealthyPercent"], 0);
        Assert.strictEqual(service.inputs["deploymentMaximumPercent"], 100);
    });
    await test("autoscaled grpc app deploys with 100 percent minimum healthy and 200 percent maximum", async () => {
        const provisioner = new GrpcAppProvisioner("grpc-as", {
            vpcDetails, subnetNamePrefix: "app", ingressSubnetNamePrefixes: ["ingress"], image: testImage, command: ["node"],
            cluster: createTestCluster(), minCapacity: 1, maxCapacity: 3
        });
        await provisioner.provision();
        const service = await waitForResource(ecsServiceType, "grpc-as-svc");
        Assert.strictEqual(service.inputs["deploymentMinimumHealthyPercent"], 100);
        Assert.strictEqual(service.inputs["deploymentMaximumPercent"], 200);
    });
    await test("autoscaled http app deploys with 100 percent minimum healthy and 200 percent maximum", async () => {
        const provisioner = new HttpAppProvisioner("http-as", {
            vpcDetails, subnetNamePrefix: "app", ingressSubnetNamePrefixes: ["ingress"], image: testImage, command: ["node"],
            cluster: createTestCluster(), minCapacity: 1, maxCapacity: 3
        });
        await provisioner.provision();
        const service = await waitForResource(ecsServiceType, "http-as-svc");
        Assert.strictEqual(service.inputs["deploymentMinimumHealthyPercent"], 100);
        Assert.strictEqual(service.inputs["deploymentMaximumPercent"], 200);
    });
});
//# sourceMappingURL=service-deployment-configuration.test.js.map