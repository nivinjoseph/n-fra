/**
 * @description Maps to the `maxmemory-policy` cache parameter.
 * https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/ParameterGroups.Engine.html
 */
export declare enum ValkeyEvictionPolicy {
    /**
     * @description Evict any key, least recently used first. Appropriate for a pure cache,
     * where losing any given key is acceptable.
     */
    allkeysLru = "allkeys-lru",
    /**
     * @description Evict only keys that have a TTL set, shortest remaining TTL first.
     * Keys written without a TTL are never evicted, so once memory fills and no TTL bearing
     * keys remain, writes fail with an out of memory error rather than silently discarding
     * data. Appropriate for a data store.
     */
    volatileTtl = "volatile-ttl",
    /**
     * @description Never evict. Once memory fills, writes fail with an out of memory error
     * instead of discarding data. Appropriate for a store and forward workload, where losing
     * any record is unacceptable.
     */
    noeviction = "noeviction"
}
//# sourceMappingURL=valkey-eviction-policy.d.ts.map