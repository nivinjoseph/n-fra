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

await describe("SubnetPool size limit", async () =>
{
    await test("rejects a pool of more than 256 subnets and states the limit", () =>
    {
        Assert.throws(() => new SubnetPool("10.0.0.0/8", 257), /256/);
    });

    await test("SubnetHelper.calculateSubnets rejects more than 256 subnets and states the limit", () =>
    {
        Assert.throws(() => SubnetHelper.calculateSubnets("10.0.0.0/8", 512), /256/);
    });

    await test("produces 256 distinct subnets at the limit", () =>
    {
        const subnets = SubnetHelper.calculateSubnets("10.0.0.0/16", 256);
        Assert.strictEqual(subnets.length, 256);
        Assert.strictEqual(subnets.distinct().length, 256);
    });
});
