import * as Assert from "assert";
import test, { describe } from "node:test";
import * as Pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { initializePulumiMocks } from "../app/app-test-harness.js";
import { VpcDetails } from "../../src/vpc/vpc-details.js";
import { VpcAz } from "../../src/vpc/vpc-az.js";
import { VpcSubnetType } from "../../src/vpc/vpc-subnet-type.js";
import type { VpcSubnetDetails } from "../../src/vpc/vpc-subnet-details.js";


await initializePulumiMocks();

function createVpcDetails(): VpcDetails
{
    const vpc = new aws.ec2.Vpc("prefix-test-vpc", { cidrBlock: "10.0.0.0/16" });
    const namespace = new aws.servicediscovery.PrivateDnsNamespace("prefix-test-ns", { name: "prefix-test.local", vpc: vpc.id });
    const subnets: Array<VpcSubnetDetails> = [
        { name: "private-app-a", prefix: "private-app", type: VpcSubnetType.private, cidrRange: "10.0.1.0/24", az: VpcAz.a },
        { name: "private-db-a", prefix: "private-db", type: VpcSubnetType.isolated, cidrRange: "10.0.2.0/24", az: VpcAz.a },
        { name: "public-ingress-a", prefix: "public-ingress", type: VpcSubnetType.public, cidrRange: "10.0.3.0/24", az: VpcAz.a }
    ].map(t => ({
        ...t,
        id: Pulumi.output(`${t.name}-subnet-id`),
        arn: Pulumi.output(`arn:aws:ec2:mock:subnet/${t.name}`),
        routeTableId: Pulumi.output(`${t.name}-rtb`)
    }));
    return new VpcDetails(vpc, "prefix-test.local", namespace, subnets);
}

const vpcDetails = createVpcDetails();

await describe("VpcDetails.resolveSubnets", async () =>
{
    await test("throws when a prefix matches no subnet and lists the prefixes that exist", () =>
    {
        Assert.throws(() => vpcDetails.resolveSubnets(["privte-app"]), (error: Error) =>
        {
            Assert.match(error.message, /privte-app/);
            Assert.match(error.message, /private-app/);
            Assert.match(error.message, /private-db/);
            Assert.match(error.message, /public-ingress/);
            return true;
        });
    });

    await test("names only the prefixes that matched nothing when others matched", () =>
    {
        Assert.throws(() => vpcDetails.resolveSubnets(["private-app", "typo"]), (error: Error) =>
        {
            Assert.match(error.message, /'typo'/);
            Assert.doesNotMatch(error.message, /'private-app'/);
            return true;
        });
    });

    await test("matches on the start of the prefix, so 'private' resolves both private subnets", () =>
    {
        const resolved = vpcDetails.resolveSubnets(["private"]);
        Assert.deepStrictEqual(resolved.map(t => t.prefix).sort(), ["private-app", "private-db"]);
    });

    await test("resolves every subnet when no prefixes are given", () =>
    {
        Assert.strictEqual(vpcDetails.resolveSubnets().length, 3);
    });
});
