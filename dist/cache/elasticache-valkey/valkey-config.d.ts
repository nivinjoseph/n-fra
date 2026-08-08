import { VpcDetails } from "../../vpc/vpc-details.js";
import { ValkeyEvictionPolicy } from "./valkey-eviction-policy.js";
import { ValkeyHaConfig } from "./valkey-ha-config.js";
export interface ValkeyConfig {
    vpcDetails: VpcDetails;
    subnetNamePrefix: string;
    ingressSubnetNamePrefixes: ReadonlyArray<string>;
    /**
     * @description Supported node types https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/CacheNodes.SupportedTypes.html
     * When haConfig.reliabilityConfig is set, the node type must belong to one of the r8g, r7g,
     * r6g, m8g, m7g, m6g, c8gn or c7gn families. T class node types are not supported with
     * durability.
     */
    nodeType: string;
    /**
     * @description Defaults to noeviction when haConfig.reliabilityConfig is set,
     * allkeysLru otherwise.
     */
    evictionPolicy?: ValkeyEvictionPolicy;
    /**
     * @description Defaults to false when haConfig is omitted, true otherwise.
     * Cannot be false when haConfig.reliabilityConfig is set, because AWS requires in transit
     * encryption to be enabled at creation for durable clusters.
     */
    isTlsEnabled?: boolean;
    /**
     * @description Omit for the cheapest deployment: a single node, no replicas, no failover,
     * plaintext, and any node type.
     *
     * Set for high availability: a primary with one or more replicas spread across availability
     * zones, with automatic failover. Still a single primary endpoint, so ordinary non cluster
     * aware clients continue to work.
     *
     * Set reliabilityConfig within it for high reliability, which additionally shards for
     * capacity and adds durability with synchronous writes.
     */
    haConfig?: ValkeyHaConfig;
}
//# sourceMappingURL=valkey-config.d.ts.map