import { AppCompute, AppComputeProfile } from "./app-compute-profile.js";
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
export declare function resolveNodeMaxOldSpaceSize(compute: AppComputeProfile | AppCompute): number;
//# sourceMappingURL=node-heap.d.ts.map