import * as Assert from "assert";
import test, { describe } from "node:test";
import { createTestCluster, createTestVpcDetails, initializePulumiMocks, waitForResource } from "./app-test-harness.js";
import { WorkerAppProvisioner } from "../../src/app/worker/worker-app-provisioner.js";


// Point the AWS SDK at a closed local port with dummy credentials so any ECR lookup fails fast and never reaches AWS.
process.env["AWS_ENDPOINT_URL_ECR"] = "http://127.0.0.1:9";
process.env["AWS_ACCESS_KEY_ID"] = "test";
process.env["AWS_SECRET_ACCESS_KEY"] = "test";
process.env["AWS_EC2_METADATA_DISABLED"] = "true";
process.env["AWS_MAX_ATTEMPTS"] = "1";

await initializePulumiMocks();
const vpcDetails = createTestVpcDetails();
const taskDefinitionType = "aws:ecs/taskDefinition:TaskDefinition";

await describe("App image verification", async () =>
{
    await test("skips the ECR lookup for public.ecr images and uses the image verbatim", async () =>
    {
        const image = "public.ecr.aws/docker/library/nginx:v1.0.0";
        await new WorkerAppProvisioner("wrk-public-ecr", {
            vpcDetails, subnetNamePrefix: "app", image, command: ["node"], cluster: createTestCluster()
        }).provision();
        const taskDefinition = await waitForResource(taskDefinitionType, "wrk-public-ecr-tsk-def");
        const containers = JSON.parse(taskDefinition.inputs["containerDefinitions"] as string) as Array<Record<string, unknown>>;
        Assert.strictEqual(containers.find(t => t["name"] === "wrk-public-ecr")!["image"], image);
    });

    await test("reports the underlying DescribeImages failure when a private ECR image cannot be verified", async () =>
    {
        await Assert.rejects(() => new WorkerAppProvisioner("wrk-private-ecr", {
            vpcDetails, subnetNamePrefix: "app", image: "my-app:v1.2.3", command: ["node"], cluster: createTestCluster()
        }).provision(), /not found in ECR \(DescribeImages failed: /);
    });
});
