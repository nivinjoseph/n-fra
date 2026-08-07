/**
 * @description Durability mode for the Valkey Multi-AZ transactional log.
 * Requires Valkey 9.0 or higher, cluster mode enabled, multi AZ, at least one replica
 * per shard, in transit encryption, and one of the supported node type families.
 * Durability can neither be enabled nor disabled after cluster creation; only switching
 * between sync and async is supported.
 * https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/durability.html
 */
export var ValkeyDurability;
(function (ValkeyDurability) {
    /**
     * @description Writes are persisted to the Multi-AZ transactional log BEFORE responding
     * to the client. Zero data loss, at the cost of single digit millisecond write latency.
     */
    ValkeyDurability["sync"] = "sync";
    /**
     * @description Writes are persisted to the Multi-AZ transactional log AFTER responding
     * to the client. Microsecond write latency, with up to 10 seconds of acknowledged writes
     * at risk. If the log falls more than 10 seconds behind, the primary rejects writes until
     * it catches up.
     */
    ValkeyDurability["async"] = "async";
})(ValkeyDurability || (ValkeyDurability = {}));
//# sourceMappingURL=valkey-durability.js.map