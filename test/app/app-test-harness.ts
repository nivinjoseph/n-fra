// load the package entry point first, exactly as consumers do, so the src module graph initializes in production order
import "../../src/index.js";
import * as Pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { VpcDetails } from "../../src/vpc/vpc-details.js";
import { VpcAz } from "../../src/vpc/vpc-az.js";
import { VpcSubnetType } from "../../src/vpc/vpc-subnet-type.js";
import type { VpcSubnetDetails } from "../../src/vpc/vpc-subnet-details.js";
import type { AppClusterDetails } from "../../src/app/app-cluster-details.js";


export interface RecordedResource
{
    type: string;
    name: string;
    inputs: Record<string, any>;
}

const recordedResources = new Array<RecordedResource>();

/**
 * Images on docker.* and public.ecr.* skip the ECR DescribeImages call in AppProvisioner and are used verbatim
 * (no ECR base prefix) when the app container is built.
 */
export const testImage = "docker.io/library/nginx:v1.0.0";

/**
 * Installs the Pulumi mock runtime. Call once per test file (node:test runs each file in its own process).
 * Stack name "test" satisfies NfraConfig.env (EnvType); aws:region satisfies the awslogs configuration.
 */
export async function initializePulumiMocks(): Promise<void>
{
    Pulumi.runtime.setAllConfig({ "aws:region": "us-east-1", "aws:allowedAccountIds": "[\"123456789012\"]" });
    await Pulumi.runtime.setMocks({
        newResource: (args) =>
        {
            recordedResources.push({ type: args.type, name: args.name, inputs: args.inputs });
            if (args.type === "pulumi:pulumi:StackReference")
                return { id: `${args.name}-id`, state: { name: args.name, outputs: {}, secretOutputNames: [] } };
            return {
                id: `${args.name}-id`,
                state: {
                    ...args.inputs,
                    name: args.inputs["name"] ?? args.name,
                    arn: `arn:aws:mock:${args.name}`,
                    arnSuffix: `${args.name}-arn-suffix`,
                    dnsName: `${args.name}.mock.local`,
                    // RDS instances and clusters expose endpoints that provisioners split into host and port
                    endpoint: `${args.name}.mock.local:5432`,
                    readerEndpoint: `${args.name}-ro.mock.local:5432`,
                    address: `${args.name}.mock.local`
                }
            };
        },
        call: (args) => args.inputs as Record<string, any>
    }, "n-fra", "test", false);
}

export function findResource(type: string, name: string): RecordedResource | null
{
    return recordedResources.find(t => t.type === type && t.name === name) ?? null;
}

/**
 * Resource registration under mocks is asynchronous and provisioners do not return resource handles,
 * so tests wait for the resource they need to appear in the recorder.
 */
export async function waitForResource(type: string, name: string, timeoutMs = 5000): Promise<RecordedResource>
{
    const start = Date.now();
    while (Date.now() - start < timeoutMs)
    {
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
export async function settleResources(quietMs = 300): Promise<void>
{
    let lastCount = -1;
    let quietSince = Date.now();
    while (Date.now() - quietSince < quietMs)
    {
        if (recordedResources.length !== lastCount)
        {
            lastCount = recordedResources.length;
            quietSince = Date.now();
        }
        await new Promise(resolve => setTimeout(resolve, 20));
    }
}

export function createTestVpcDetails(): VpcDetails
{
    const vpc = new aws.ec2.Vpc("test-vpc", { cidrBlock: "10.0.0.0/16" });
    const namespace = new aws.servicediscovery.PrivateDnsNamespace("test-ns", { name: "test.local", vpc: vpc.id });
    const subnets: Array<VpcSubnetDetails> = [
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

export function createTestCluster(): AppClusterDetails
{
    return {
        clusterName: Pulumi.output("test-cluster"),
        clusterArn: Pulumi.output("arn:aws:ecs:mock:cluster/test-cluster"),
        usesSpotInstances: false
    };
}
