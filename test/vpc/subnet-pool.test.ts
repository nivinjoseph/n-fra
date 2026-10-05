import * as Assert from "assert";
import test, { describe } from "node:test";
import { initializePulumiMocks } from "../app/app-test-harness.js";
import { SubnetPool } from "../../src/vpc/subnet-pool.js";
import { SubnetHelper } from "../../src/vpc/subnet-helper.js";
import { VpcSubnetType } from "../../src/vpc/vpc-subnet-type.js";


await initializePulumiMocks();

await describe("SubnetPool validation messages", async () =>
{
    await test("rejects reserving more than 3 subnets at once and states the limit", () =>
    {
        const pool = new SubnetPool("10.0.0.0/16", 8);
        Assert.throws(() => pool.reserveSubnets("private-app", VpcSubnetType.private, 4 as 1 | 2 | 3), /between 1 and 3/);
    });

    await test("rejects a pool that needs more subnet bits than the VPC CIDR has, naming both", () =>
    {
        Assert.throws(() => new SubnetPool("10.0.0.0/28", 32), (error: Error) =>
        {
            Assert.match(error.message, /32 subnets need 5 subnet bits/);
            Assert.match(error.message, /10\.0\.0\.0\/28 only has 4 bits/);
            return true;
        });
    });
});

await describe("Subnet count limits", async () =>
{
    await test("produces 256 distinct subnets at 256", () =>
    {
        const subnets = SubnetHelper.calculateSubnets("10.0.0.0/16", 256);
        Assert.strictEqual(subnets.length, 256);
        Assert.strictEqual(subnets.distinct().length, 256);
    });

    await test("splits a /16 into 512 distinct /25 subnets in address order", () =>
    {
        const subnets = SubnetHelper.calculateSubnets("10.0.0.0/16", 512);
        Assert.strictEqual(subnets.length, 512);
        Assert.strictEqual(subnets.distinct().length, 512);
        Assert.deepStrictEqual(subnets.take(4), ["10.0.0.0/25", "10.0.0.128/25", "10.0.1.0/25", "10.0.1.128/25"]);
        Assert.strictEqual(subnets.takeLast(), "10.0.255.128/25");
    });

    await test("rounds the count up to the next power of two", () =>
    {
        Assert.strictEqual(SubnetHelper.calculateSubnets("10.0.0.0/16", 300).length, 512);
    });

    await test("can use every host bit of the range", () =>
    {
        const subnets = SubnetHelper.calculateSubnets("10.0.0.0/24", 256);
        Assert.strictEqual(subnets.length, 256);
        Assert.strictEqual(subnets.takeFirst(), "10.0.0.0/32");
        Assert.strictEqual(subnets[1], "10.0.0.1/32");
        Assert.strictEqual(subnets.takeLast(), "10.0.0.255/32");
    });

    await test("rejects a count the range cannot hold, naming the bits needed and available", () =>
    {
        Assert.throws(() => SubnetHelper.calculateSubnets("10.0.0.0/24", 257), (error: Error) =>
        {
            Assert.match(error.message, /257 subnets need 9 subnet bits/);
            Assert.match(error.message, /10\.0\.0\.0\/24 only has 8 bits/);
            return true;
        });
    });

    await test("a pool above 256 hands out a correct split", () =>
    {
        const reservations = new SubnetPool("10.0.0.0/8", 1024).reserveSubnets("private-app", VpcSubnetType.private, 3);
        Assert.deepStrictEqual(reservations.map(t => t.cidrRange), ["10.0.0.0/18", "10.0.64.0/18", "10.0.128.0/18"]);
    });

    await test("rejects a count that is not a positive integer", () =>
    {
        Assert.throws(() => SubnetHelper.calculateSubnets("10.0.0.0/16", 0), /positive integer/);
        Assert.throws(() => SubnetHelper.calculateSubnets("10.0.0.0/16", 2.5), /positive integer/);
        Assert.throws(() => new SubnetPool("10.0.0.0/16", 0), /positive integer/);
        Assert.throws(() => new SubnetPool("10.0.0.0/16", 2.5), /positive integer/);
    });

    await test("returns the range itself for a count of 1", () =>
    {
        Assert.deepStrictEqual(SubnetHelper.calculateSubnets("10.0.0.0/16", 1), ["10.0.0.0/16"]);
    });

    await test("keeps the layout for small counts", () =>
    {
        Assert.deepStrictEqual(SubnetHelper.calculateSubnets("10.0.0.0/16", 8).take(3), ["10.0.0.0/19", "10.0.32.0/19", "10.0.64.0/19"]);
    });
});

await describe("Legacy subnet layout (n-fra <= 5.0.9 with numSubnets 257..1024)", async () =>
{
    await test("SubnetHelper.calculateLegacySubnets reproduces the /16 layout: /25 subnets, each the lower half of a /24", () =>
    {
        const subnets = SubnetHelper.calculateLegacySubnets("10.11.0.0/16");
        Assert.deepStrictEqual(subnets.take(9), [
            "10.11.0.0/25", "10.11.1.0/25", "10.11.2.0/25", "10.11.3.0/25", "10.11.4.0/25",
            "10.11.5.0/25", "10.11.6.0/25", "10.11.7.0/25", "10.11.8.0/25"
        ]);
        Assert.strictEqual(subnets.takeLast(), "10.11.255.0/25");
    });

    await test("SubnetHelper.calculateLegacySubnets reproduces the /8 layout: /17 subnets", () =>
    {
        const subnets = SubnetHelper.calculateLegacySubnets("10.0.0.0/8");
        Assert.deepStrictEqual(subnets.take(3), ["10.0.0.0/17", "10.1.0.0/17", "10.2.0.0/17"]);
        Assert.strictEqual(subnets.takeLast(), "10.255.0.0/17");
    });

    await test("SubnetHelper.calculateLegacySubnets produces 256 distinct subnets without the old padding duplicates", () =>
    {
        const subnets = SubnetHelper.calculateLegacySubnets("10.11.0.0/16");
        Assert.strictEqual(subnets.length, 256);
        Assert.strictEqual(subnets.distinct().length, 256);
    });

    await test("SubnetHelper.calculateLegacySubnets rejects a /24, naming the range and the bit requirement", () =>
    {
        Assert.throws(() => SubnetHelper.calculateLegacySubnets("10.11.0.0/24"), (error: Error) =>
        {
            Assert.match(error.message, /9 subnet bits/);
            Assert.match(error.message, /10\.11\.0\.0\/24 only has 8 bits/);
            return true;
        });
    });

    await test("SubnetPool.legacy hands out the legacy subnets in order", () =>
    {
        const reservations = SubnetPool.legacy("10.11.0.0/16").reserveSubnets("public-seed", VpcSubnetType.public, 3);
        Assert.deepStrictEqual(reservations.map(t => t.name), ["public-seed-1", "public-seed-2", "public-seed-3"]);
        Assert.deepStrictEqual(reservations.map(t => t.cidrRange), ["10.11.0.0/25", "10.11.1.0/25", "10.11.2.0/25"]);
    });

    await test("SubnetPool.legacy runs out after 256 subnets", () =>
    {
        const pool = SubnetPool.legacy("10.11.0.0/16");
        for (let i = 0; i < 85; i++)
        {
            pool.reserveSubnets(`private-${i}`, VpcSubnetType.private, 3);
        }
        pool.reserveSubnets("private-last", VpcSubnetType.private, 1);
        Assert.throws(() => pool.reserveSubnets("private-overflow", VpcSubnetType.private, 1), /not enough subnets left in the pool/);
    });

    await test("SubnetPool.legacy rejects a /24 with the legacy requirement rather than the 256-subnet one", () =>
    {
        Assert.throws(() => SubnetPool.legacy("10.11.0.0/24"), /9 subnet bits/);
    });
});

await describe("SubnetHelper.isCidrWithin", async () =>
{
    await test("is true for a range inside the parent, including the parent itself and the last block", () =>
    {
        Assert.strictEqual(SubnetHelper.isCidrWithin("10.0.1.0/24", "10.0.0.0/16"), true);
        Assert.strictEqual(SubnetHelper.isCidrWithin("10.0.0.0/16", "10.0.0.0/16"), true);
        Assert.strictEqual(SubnetHelper.isCidrWithin("10.0.255.128/25", "10.0.0.0/16"), true);
    });

    await test("is false for a range outside the parent or wider than it", () =>
    {
        Assert.strictEqual(SubnetHelper.isCidrWithin("10.1.0.0/24", "10.0.0.0/16"), false);
        Assert.strictEqual(SubnetHelper.isCidrWithin("10.0.0.0/8", "10.0.0.0/16"), false);
        Assert.strictEqual(SubnetHelper.isCidrWithin("192.168.0.0/24", "10.0.0.0/8"), false);
    });

    await test("compares network blocks, so host bits set on either side do not matter", () =>
    {
        Assert.strictEqual(SubnetHelper.isCidrWithin("10.0.1.5/24", "10.0.0.0/16"), true);
        Assert.strictEqual(SubnetHelper.isCidrWithin("10.0.1.0/24", "10.0.0.5/16"), true);
    });

    await test("handles the /0 and /32 extremes", () =>
    {
        Assert.strictEqual(SubnetHelper.isCidrWithin("192.168.0.0/24", "0.0.0.0/0"), true);
        Assert.strictEqual(SubnetHelper.isCidrWithin("10.0.0.1/32", "10.0.0.1/32"), true);
        Assert.strictEqual(SubnetHelper.isCidrWithin("10.0.0.1/32", "10.0.0.2/32"), false);
        Assert.strictEqual(SubnetHelper.isCidrWithin("0.0.0.0/0", "10.0.0.0/8"), false);
    });
});
