import * as Assert from "assert";
import test, { describe } from "node:test";
import { createTestVpcDetails, initializePulumiMocks } from "../app/app-test-harness.js";
import { RdsProxyProvisioner } from "../../src/database/rds-proxy/rds-proxy-provisioner.js";
import type { RdsProxyConfig } from "../../src/database/rds-proxy/rds-proxy-config.js";


await initializePulumiMocks();
const vpcDetails = createTestVpcDetails();

await describe("RDS proxy config validation", async () =>
{
    await test("rejects a config missing required fields and names the first missing one", () =>
    {
        const incomplete = { vpcDetails, dbSubnetNamePrefix: "app" } as unknown as RdsProxyConfig;
        Assert.throws(() => new RdsProxyProvisioner("proxy-incomplete", incomplete), /missing required property 'dbDetails'/);
    });
});
