import * as Assert from "assert";
import test, { describe } from "node:test";
import { AppCompute, AppComputeProfile, resolveNodeMaxOldSpaceSize } from "../../src/index.js";


await describe("resolveNodeMaxOldSpaceSize", async () =>
{
    const expectedByProfile: ReadonlyArray<[AppComputeProfile, number | null]> = [
        [AppComputeProfile.xsmall, null],
        [AppComputeProfile.small, null],
        [AppComputeProfile.medium, 1024],
        [AppComputeProfile.large, 3072],
        [AppComputeProfile.xlarge, 7168],
        [AppComputeProfile.xxlarge, 14336],
        [AppComputeProfile.xxxlarge, 28672],
        [AppComputeProfile.xsmallMemoryOptimized, 1024],
        [AppComputeProfile.smallMemoryOptimized, 3072],
        [AppComputeProfile.mediumMemoryOptimized, 7168],
        [AppComputeProfile.largeMemoryOptimized, 14336],
        [AppComputeProfile.xlargeMemoryOptimized, 26880],
        [AppComputeProfile.xxlargeMemoryOptimized, 53760],
        [AppComputeProfile.xxxlargeMemoryOptimized, 107520]
    ];

    for (const [profile, expected] of expectedByProfile)
    {
        if (expected == null)
        {
            await test(`${AppComputeProfile[profile]} profile throws`, () =>
            {
                Assert.throws(() => resolveNodeMaxOldSpaceSize(profile));
            });
        }
        else
        {
            await test(`${AppComputeProfile[profile]} profile resolves to ${expected}`, () =>
            {
                Assert.strictEqual(resolveNodeMaxOldSpaceSize(profile), expected);
            });
        }
    }

    await test("custom compute uses proportional headroom when it exceeds the fixed headroom", () =>
    {
        Assert.strictEqual(resolveNodeMaxOldSpaceSize({ cpu: 4096, memory: 12288 }), 10752);
    });

    await test("custom compute at the minimum task memory resolves", () =>
    {
        Assert.strictEqual(resolveNodeMaxOldSpaceSize({ cpu: 1024, memory: 2048 }), 1024);
    });

    await test("custom compute under the minimum task memory throws", () =>
    {
        Assert.throws(() => resolveNodeMaxOldSpaceSize({ cpu: 512, memory: 1536 }));
    });

    await test("null throws", () =>
    {
        Assert.throws(() => resolveNodeMaxOldSpaceSize(null as unknown as AppComputeProfile));
    });

    await test("invalid profile throws", () =>
    {
        Assert.throws(() => resolveNodeMaxOldSpaceSize(99 as AppComputeProfile));
    });

    await test("custom compute without memory throws", () =>
    {
        Assert.throws(() => resolveNodeMaxOldSpaceSize({ cpu: 1024 } as AppCompute));
    });
});
