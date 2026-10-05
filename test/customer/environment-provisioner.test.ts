import * as Assert from "assert";
import test, { describe } from "node:test";
import { initializePulumiMocks } from "../app/app-test-harness.js";
import { EnvironmentProvisioner, type EnvironmentOutput } from "../../src/customer/environment-provisioner.js";
import { EnvType } from "../../src/common/env-type.js";


await initializePulumiMocks();

class ProbeEnvironmentProvisioner extends EnvironmentProvisioner<EnvironmentOutput>
{
    public fetch(env: EnvType): Promise<unknown>
    {
        return this.fetchEnvironmentOutput(env);
    }

    protected provisionEnvironment(): Promise<EnvironmentOutput>
    {
        return Promise.resolve({});
    }
}

await describe("EnvironmentProvisioner.fetchEnvironmentOutput", async () =>
{
    await test("rejects with an Error, not a bare string, when the referenced stack has no stackOutput", async () =>
    {
        await Assert.rejects(() => new ProbeEnvironmentProvisioner().fetch(EnvType.dev), (error: unknown) =>
        {
            Assert.ok(error instanceof Error, `expected an Error, got ${typeof error}`);
            Assert.match(error.message, /Stack output for stack 'dev' not found/);
            return true;
        });
    });
});
