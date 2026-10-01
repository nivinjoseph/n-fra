import { given } from "@nivinjoseph/n-defensive";
import { AppCompute, AppComputeProfile, resolveAppCompute } from "./app-compute-profile.js";


const minTaskMemoryMb = 2048;
const fixedHeadroomMb = 1024;
const proportionalHeadroom = 1 / 8;

/**
 * Computes `--max-old-space-size` (MB) for a Node app running on the given
 * compute, either an AppComputeProfile or a custom AppCompute.
 *
 * The task's memory is a hard ceiling shared by the app container and the two
 * soft-limited sidecars (datadog-agent, log_router). The flag bounds only V8's
 * old generation; Buffers/ArrayBuffers, native memory and worker-thread
 * isolates (each of which gets its own heap of this size) sit outside it.
 * Headroom is therefore the larger of a 1 GB fixed cost (sidecars + Node
 * non-heap memory) and one eighth of task memory (V8 overshoot and
 * fragmentation at large heaps, plus modest external Buffer usage). Task
 * memory under 2 GB is rejected: the fixed cost would consume the whole task,
 * so such apps should not carry the flag at all.
 *
 * @example
 * NODE_OPTIONS: `--max-old-space-size=${resolveNodeMaxOldSpaceSize(AppComputeProfile.large)}`
 */
export function resolveNodeMaxOldSpaceSize(compute: AppComputeProfile | AppCompute): number
{
    given(compute, "compute").ensureHasValue();

    let taskMemoryMb: number;
    if (typeof compute === "number")
    {
        given(compute, "compute").ensureIsEnum(AppComputeProfile);
        taskMemoryMb = resolveAppCompute(compute).memory;
    }
    else
    {
        given(compute, "compute").ensureIsObject()
            .ensureHasStructure({ cpu: "number", memory: "number" });
        taskMemoryMb = compute.memory;
    }

    given(taskMemoryMb, "compute").ensure(t => t >= minTaskMemoryMb,
        `task memory of ${taskMemoryMb} MB is too small for an explicit --max-old-space-size; at least ${minTaskMemoryMb} MB is required`);

    const headroomMb = Math.max(fixedHeadroomMb, Math.floor(taskMemoryMb * proportionalHeadroom));

    return taskMemoryMb - headroomMb;
}
