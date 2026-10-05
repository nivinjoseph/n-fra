import * as Assert from "assert";
import test, { describe } from "node:test";
import { AppComputeProfile, resolveAppCompute, type AppConfig, type AppConfigShape, type AppDetails, type Aspv2ConfigBase, type HttpAppConfigExtension, type EnvironmentOutput, type MariaInstanceConfigBase, type PolicyStatement, type PostgresInstanceConfigBase, type Principal, type SubnetDetails, type VpcSubnetDetails } from "../src/index.js";


await describe("package entry point exports", async () =>
{
    await test("exports the base AppConfig and AppDetails types", () =>
    {
        const config: Pick<AppConfig, "image" | "subnetNamePrefix"> = { image: "docker.io/library/nginx:v1.0.0", subnetNamePrefix: "private-app" };
        const details: AppDetails = {};
        Assert.strictEqual(config.subnetNamePrefix, "private-app");
        Assert.ok(details);
    });

    await test("exports the subnet detail types that VpcDetails consumes and produces", () =>
    {
        const vpcSubnetKeys: Array<keyof VpcSubnetDetails> = ["name", "prefix", "type", "cidrRange", "az", "id", "arn", "routeTableId"];
        const resolvedKeys: Array<keyof SubnetDetails> = ["id", "prefix", "cidrBlock", "arn", "availabilityZone", "vpcId"];
        Assert.strictEqual(vpcSubnetKeys.length, 8);
        Assert.strictEqual(resolvedKeys.length, 6);
    });

    await test("exports EnvironmentOutput and the IAM policy statement types", () =>
    {
        const output: EnvironmentOutput = {};
        const statements: Array<PolicyStatement> = [];
        const principal: Principal = "*";
        Assert.deepStrictEqual(output, {});
        Assert.strictEqual(statements.length, 0);
        Assert.strictEqual(principal, "*");
    });

    await test("exports the database base config interfaces so consumers can extend them", () =>
    {
        const postgresKeys: Array<keyof PostgresInstanceConfigBase> = ["instanceClass", "storageGb"];
        const mariaKeys: Array<keyof MariaInstanceConfigBase> = ["instanceClass", "storageGb"];
        const auroraKeys: Array<keyof Aspv2ConfigBase> = ["minCapacity", "maxCapacity"];
        Assert.strictEqual(postgresKeys.length + mariaKeys.length + auroraKeys.length, 6);
    });

    await test("exports the http extension and the non-union validation shape for AppProvisioner subclasses", () =>
    {
        const extensionKeys: Array<keyof HttpAppConfigExtension> = ["ingressSubnetNamePrefixes", "albTargetGroupArn", "defaultAppPortOverride"];
        const shapeKeys: Array<keyof AppConfigShape> = ["cluster", "clusterConfig", "command", "entryPoint"];
        Assert.strictEqual(extensionKeys.length + shapeKeys.length, 7);
    });

    await test("exports resolveAppCompute and xsmall resolves to 256 cpu units", () =>
    {
        Assert.strictEqual(typeof resolveAppCompute, "function");
        Assert.deepStrictEqual(resolveAppCompute(AppComputeProfile.xsmall), { cpu: 256, memory: 512 });
    });
});
