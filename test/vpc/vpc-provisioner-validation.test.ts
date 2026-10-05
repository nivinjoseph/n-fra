import * as Assert from "assert";
import test, { describe } from "node:test";
import { initializePulumiMocks } from "../app/app-test-harness.js";
import { VpcProvisioner } from "../../src/vpc/vpc-provisioner.js";
import { VpcAz } from "../../src/vpc/vpc-az.js";
import { VpcSubnetType } from "../../src/vpc/vpc-subnet-type.js";
import type { VpcSubnetConfig } from "../../src/vpc/vpc-subnet-config.js";


await initializePulumiMocks();

await describe("VPC config validation", async () =>
{
    await test("rejects a subnet without a prefix and names the field", () =>
    {
        const subnetWithoutPrefix = { name: "private-app-a", type: VpcSubnetType.private, cidrRange: "10.0.1.0/24", az: VpcAz.a } as unknown as VpcSubnetConfig;
        Assert.throws(() => new VpcProvisioner("vpc-noprefix", { cidrRange: "10.0.0.0/16", subnets: [subnetWithoutPrefix] }),
            /subnets\.0\.prefix/);
    });
});

const validSubnet: VpcSubnetConfig = { name: "private-app-a", prefix: "private-app", type: VpcSubnetType.private, cidrRange: "10.0.1.0/24", az: VpcAz.a };

await describe("VPC config validation messages", async () =>
{
    await test("rejects a name longer than 20 characters and states the limit", () =>
    {
        Assert.throws(() => new VpcProvisioner("a".repeat(21), { cidrRange: "10.0.0.0/16", subnets: [validSubnet] }), /20 characters/);
    });

    await test("rejects a subnet type outside the enum at construction and lists the valid values", () =>
    {
        const badType = { ...validSubnet, type: "public" as VpcSubnetType };
        Assert.throws(() => new VpcProvisioner("vpc-bad-type", { cidrRange: "10.0.0.0/16", subnets: [badType] }), /must be one of Public, Private, Isolated/);
    });

    await test("rejects a subnet az outside the enum at construction and lists the valid values", () =>
    {
        const badAz = { ...validSubnet, az: "z" as VpcAz };
        Assert.throws(() => new VpcProvisioner("vpc-bad-az", { cidrRange: "10.0.0.0/16", subnets: [badAz] }), (error: Error) =>
        {
            Assert.match(error.message, /'z'/);
            Assert.match(error.message, /must be one of a, b/);
            return true;
        });
    });
});

await describe("VPC config rules", async () =>
{
    const vpc = (subnets: Array<VpcSubnetConfig>, numNatGateways?: 0 | 1 | 3): VpcProvisioner =>
        new VpcProvisioner("vpc-rules", { cidrRange: "10.0.0.0/16", subnets, numNatGateways });

    await test("subnet prefixes must contain public, private or isolated", () =>
    {
        Assert.throws(() => vpc([{ ...validSubnet, name: "app-a", prefix: "app" }]), /public, private or isolated/);
    });

    await test("subnet names must start with their prefix", () =>
    {
        Assert.throws(() => vpc([{ ...validSubnet, name: "app-a" }]), /start with the subnet's prefix/);
    });

    await test("subnet names and cidr ranges must be unique", () =>
    {
        Assert.throws(() => vpc([validSubnet, { ...validSubnet, cidrRange: "10.0.2.0/24" }]), /subnet name must be unique/);
        Assert.throws(() => vpc([validSubnet, { ...validSubnet, name: "private-app-b" }]), /cidrRange must be unique/);
    });

    await test("numNatGateways must be 0, 1 or 3", () =>
    {
        Assert.throws(() => vpc([validSubnet], 2 as 0 | 1 | 3), /numNatGateways must be 0 or 1 or 3/);
        Assert.doesNotThrow(() => vpc([validSubnet], 0));
    });
});

await describe("VPC availability zones", async () =>
{
    await test("rejects an az that the stack's region does not offer, at construction, naming the region", () =>
    {
        const zoneD = { ...validSubnet, az: VpcAz.d };
        Assert.throws(() => new VpcProvisioner("vpc-az-d", { cidrRange: "10.0.0.0/16", subnets: [zoneD] }), (error: Error) =>
        {
            Assert.match(error.message, /'d'/);
            Assert.match(error.message, /us-east-1/);
            return true;
        });
    });
});

await describe("VPC subnet cidr containment", async () =>
{
    const vpc = (subnets: Array<VpcSubnetConfig>): VpcProvisioner =>
        new VpcProvisioner("vpc-cidrs", { cidrRange: "10.0.0.0/16", subnets });

    await test("rejects a subnet outside the VPC cidrRange, naming both", () =>
    {
        Assert.throws(() => vpc([{ ...validSubnet, cidrRange: "10.1.0.0/24" }]), (error: Error) =>
        {
            Assert.match(error.message, /'10\.1\.0\.0\/24'/);
            Assert.match(error.message, /must fall inside the VPC cidrRange '10\.0\.0\.0\/16'/);
            return true;
        });
    });

    await test("rejects a subnet wider than the VPC cidrRange", () =>
    {
        Assert.throws(() => vpc([{ ...validSubnet, cidrRange: "10.0.0.0/8" }]), /must fall inside the VPC cidrRange/);
    });

    await test("rejects a subnet cidrRange that is not a CIDR at construction", () =>
    {
        Assert.throws(() => vpc([{ ...validSubnet, cidrRange: "10.0.1.0" }]), /'10\.0\.1\.0' is not a valid CIDR/);
    });

    await test("accepts the last block of the VPC cidrRange", () =>
    {
        Assert.doesNotThrow(() => vpc([{ ...validSubnet, cidrRange: "10.0.255.128/25" }]));
    });

    await test("still accepts a subnet cidrRange with surrounding whitespace", () =>
    {
        Assert.doesNotThrow(() => vpc([{ ...validSubnet, cidrRange: " 10.0.1.0/24 " }]));
    });
});
