// load the package entry point first, exactly as consumers do, so the src module graph initializes in production order
import "../../src/index.js";
import * as Pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { VpcDetails } from "../../src/vpc/vpc-details.js";
import { VpcAz } from "../../src/vpc/vpc-az.js";
import { VpcSubnetType } from "../../src/vpc/vpc-subnet-type.js";
const recordedResources = new Array();
/**
 * Only images on docker.* skip the ECR DescribeImages call in AppProvisioner.
 */
export const testImage = "docker.io/library/nginx:v1.0.0";
/**
 * Installs the Pulumi mock runtime. Call once per test file (node:test runs each file in its own process).
 * Stack name "test" satisfies NfraConfig.env (EnvType); aws:region satisfies the awslogs configuration.
 */
export async function initializePulumiMocks() {
    Pulumi.runtime.setAllConfig({ "aws:region": "us-east-1" });
    await Pulumi.runtime.setMocks({
        newResource: (args) => {
            recordedResources.push({ type: args.type, name: args.name, inputs: args.inputs });
            return {
                id: `${args.name}-id`,
                state: {
                    ...args.inputs,
                    name: args.inputs["name"] ?? args.name,
                    arn: `arn:aws:mock:${args.name}`,
                    arnSuffix: `${args.name}-arn-suffix`,
                    dnsName: `${args.name}.mock.local`
                }
            };
        },
        call: (args) => args.inputs
    }, "n-fra", "test", false);
}
export function resolveOutput(output) {
    return new Promise(resolve => {
        output.apply(value => {
            resolve(value);
            return value;
        });
    });
}
export function findResources(type) {
    return recordedResources.filter(t => t.type === type);
}
export function findResource(type, name) {
    return recordedResources.find(t => t.type === type && t.name === name) ?? null;
}
/**
 * Resource registration under mocks is asynchronous and provisioners do not return resource handles,
 * so tests wait for the resource they need to appear in the recorder.
 */
export async function waitForResource(type, name, timeoutMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const found = findResource(type, name);
        if (found != null)
            return found;
        await new Promise(resolve => setTimeout(resolve, 20));
    }
    const seen = recordedResources.map(t => `${t.type}::${t.name}`).join("\n");
    throw new Error(`Timed out waiting for resource ${type}::${name}. Seen:\n${seen}`);
}
/**
 * Waits for a bounded quiet period so that resources which are NOT expected can be asserted absent.
 */
export async function settleResources(quietMs = 300) {
    let lastCount = -1;
    let quietSince = Date.now();
    while (Date.now() - quietSince < quietMs) {
        if (recordedResources.length !== lastCount) {
            lastCount = recordedResources.length;
            quietSince = Date.now();
        }
        await new Promise(resolve => setTimeout(resolve, 20));
    }
}
export function createTestVpcDetails() {
    const vpc = new aws.ec2.Vpc("test-vpc", { cidrBlock: "10.0.0.0/16" });
    const namespace = new aws.servicediscovery.PrivateDnsNamespace("test-ns", { name: "test.local", vpc: vpc.id });
    const subnets = [
        { name: "app-a", prefix: "app", type: VpcSubnetType.private, cidrRange: "10.0.1.0/24", az: VpcAz.a },
        { name: "ingress-a", prefix: "ingress", type: VpcSubnetType.public, cidrRange: "10.0.2.0/24", az: VpcAz.a }
    ].map(t => ({
        ...t,
        id: Pulumi.output(`${t.name}-subnet-id`),
        arn: Pulumi.output(`arn:aws:ec2:mock:subnet/${t.name}`),
        routeTableId: Pulumi.output(`${t.name}-rtb`)
    }));
    return new VpcDetails(vpc, "test.local", namespace, subnets);
}
export function createTestCluster() {
    return {
        clusterName: Pulumi.output("test-cluster"),
        clusterArn: Pulumi.output("arn:aws:ecs:mock:cluster/test-cluster"),
        usesSpotInstances: false
    };
}
export function createTestDatadogConfig() {
    return {
        ddHost: "datadoghq.com",
        apiKey: { name: "dd-api-key", arn: Pulumi.output("arn:aws:secretsmanager:mock:dd-api-key") }
    };
}
//# sourceMappingURL=app-test-harness.js.map