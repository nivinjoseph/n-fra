import { ValkeyReliabilityConfig } from "./valkey-reliability-config.js";
export interface ValkeyHaConfig {
    /**
     * @description Number of replicas in each shard. Must be between 1 and 5. Defaults to 1.
     * Note that this counts replicas only, the primary is not included.
     */
    numReplicasPerShard?: number;
    /**
     * @description Omit for high availability. Set for high reliability, which adds shards for
     * capacity distribution and durability with synchronous writes, backed by the Valkey 9
     * Multi-AZ transactional log.
     *
     * Setting this turns on cluster mode, so clients must be cluster aware and connect to the
     * configuration endpoint. It also restricts the node type to the r8g, r7g, r6g, m8g, m7g,
     * m6g, c8gn and c7gn families, and requires in transit encryption.
     *
     * This cannot be added to or removed from an existing cluster. AWS does not allow durability
     * to be enabled or disabled after creation, and the cluster mode change forces the
     * replication group to be replaced.
     */
    reliabilityConfig?: ValkeyReliabilityConfig;
}
//# sourceMappingURL=valkey-ha-config.d.ts.map