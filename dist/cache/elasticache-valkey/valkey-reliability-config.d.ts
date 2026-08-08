export interface ValkeyReliabilityConfig {
    /**
     * @description Number of shards (node groups) to distribute capacity across. Defaults to 1.
     * Total node count is numShards * (1 + numReplicasPerShard).
     */
    numShards?: number;
}
//# sourceMappingURL=valkey-reliability-config.d.ts.map