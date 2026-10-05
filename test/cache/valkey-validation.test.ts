import * as Assert from "assert";
import test, { describe } from "node:test";
import { createTestVpcDetails, initializePulumiMocks } from "../app/app-test-harness.js";
import { ValkeyProvisioner } from "../../src/cache/elasticache-valkey/valkey-provisioner.js";
import type { ValkeyEvictionPolicy } from "../../src/cache/elasticache-valkey/valkey-eviction-policy.js";


await initializePulumiMocks();
const vpcDetails = createTestVpcDetails();

await describe("Valkey config validation messages", async () =>
{
    await test("rejects an unknown eviction policy and lists the valid values", () =>
    {
        Assert.throws(() => new ValkeyProvisioner("vk-bad-policy", {
            vpcDetails, subnetNamePrefix: "app", ingressSubnetNamePrefixes: ["app"], nodeType: "cache.t4g.micro",
            evictionPolicy: "lru" as ValkeyEvictionPolicy
        }), /must be one of allkeys-lru, volatile-ttl, noeviction/);
    });
});
