import { ValkeyDurability } from "./valkey-durability.js";
export interface ValkeyHaConfig {
    /**
     * @description Durability mode for the Multi-AZ transactional log. Defaults to sync.
     */
    durability?: ValkeyDurability;
    /**
     * @description Number of shards (node groups). Defaults to 1.
     * Total node count is numShards * (1 + numReplicasPerShard).
     */
    numShards?: number;
    /**
     * @description Number of replicas in each shard. Defaults to 1. Must be at least 1
     * because durability requires multi AZ with at least one replica per shard.
     * Note that this counts replicas only, the primary is not included.
     */
    numReplicasPerShard?: number;
}
//# sourceMappingURL=valkey-ha-config.d.ts.map