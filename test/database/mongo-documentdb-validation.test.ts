import * as Assert from "assert";
import test, { describe } from "node:test";
import { createTestVpcDetails, initializePulumiMocks } from "../app/app-test-harness.js";
import { MongoDocumentdbProvisioner } from "../../src/database/mongo-documentdb/mongo-documentdb-provisioner.js";
import type { MongoDocumentdbConfig } from "../../src/database/mongo-documentdb/mongo-documentdb-config.js";


await initializePulumiMocks();
const vpcDetails = createTestVpcDetails();

await describe("DocumentDB config validation", async () =>
{
    await test("rejects a config missing the username and names the field", () =>
    {
        const incomplete = { vpcDetails, subnetNamePrefix: "app", ingressSubnetNamePrefixes: ["app"], password: "pw" } as unknown as MongoDocumentdbConfig;
        Assert.throws(() => new MongoDocumentdbProvisioner("docdb-incomplete", incomplete), /missing required property 'username'/);
    });
});
