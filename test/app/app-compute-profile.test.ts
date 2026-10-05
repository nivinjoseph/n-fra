import * as Assert from "assert";
import test, { describe } from "node:test";
import { type AppComputeProfile, resolveAppCompute } from "../../src/app/app-compute-profile.js";


await describe("resolveAppCompute", async () =>
{
    await test("rejects an unknown profile and lists the valid profile names", () =>
    {
        Assert.throws(() => resolveAppCompute(999 as AppComputeProfile), /must be one of xsmall, small, medium/);
    });
});
