/**
 * @description Maps to the `maxmemory-policy` cache parameter.
 * https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/ParameterGroups.Engine.html
 */
export var ValkeyEvictionPolicy;
(function (ValkeyEvictionPolicy) {
    /**
     * @description Evict any key, least recently used first. Appropriate for a pure cache,
     * where losing any given key is acceptable.
     */
    ValkeyEvictionPolicy["allkeysLru"] = "allkeys-lru";
    /**
     * @description Evict only keys that have a TTL set, shortest remaining TTL first.
     * Keys written without a TTL are never evicted, so once memory fills and no TTL bearing
     * keys remain, writes fail with an out of memory error rather than silently discarding
     * data. Appropriate for a data store.
     */
    ValkeyEvictionPolicy["volatileTtl"] = "volatile-ttl";
    /**
     * @description Never evict. Once memory fills, writes fail with an out of memory error
     * instead of discarding data. Appropriate for a store and forward workload, where losing
     * any record is unacceptable.
     */
    ValkeyEvictionPolicy["noeviction"] = "noeviction";
})(ValkeyEvictionPolicy || (ValkeyEvictionPolicy = {}));
//# sourceMappingURL=valkey-eviction-policy.js.map