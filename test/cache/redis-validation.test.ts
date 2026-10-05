import * as Assert from "assert";
import test, { describe } from "node:test";
import { createTestVpcDetails, initializePulumiMocks } from "../app/app-test-harness.js";
import { RedisProvisioner } from "../../src/cache/elasticache-redis/redis-provisioner.js";


await initializePulumiMocks();
const vpcDetails = createTestVpcDetails();
const config = { vpcDetails, subnetNamePrefix: "app", ingressSubnetNamePrefixes: ["app"], nodeType: "cache.t4g.micro" };

await describe("Redis config validation", async () =>
{
    await test("rejects a null name", () =>
    {
        Assert.throws(() => new RedisProvisioner(null as unknown as string, config), /Argument 'name'/);
    });
});
