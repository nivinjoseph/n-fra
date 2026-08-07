import { VpcDetails } from "../../vpc/vpc-details.js";
import { ValkeyEvictionPolicy } from "./valkey-eviction-policy.js";
import { ValkeyHaConfig } from "./valkey-ha-config.js";


export interface ValkeyConfig
{
    vpcDetails: VpcDetails;
    subnetNamePrefix: string;
    ingressSubnetNamePrefixes: ReadonlyArray<string>;
    /**
     * @description Supported node types https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/CacheNodes.SupportedTypes.html
     * When haConfig is set, the node type must belong to one of the r8g, r7g, r6g, m8g, m7g,
     * m6g, c8gn or c7gn families. T class node types are not supported with durability.
     */
    nodeType: string;
    /**
     * @description Defaults to volatileTtl when haConfig is set (durable data store),
     * allkeysLru otherwise (pure cache).
     */
    evictionPolicy?: ValkeyEvictionPolicy;
    /**
     * @description Omit for the cheapest deployment: a single node, no replicas,
     * no durability, plaintext, and any node type.
     *
     * When set, the cluster becomes a durable data store. That turns on the Valkey 9
     * Multi-AZ transactional log, and with it cluster mode, in transit encryption,
     * multi AZ, and at least one replica per shard. Clients must therefore be cluster
     * aware and must connect over TLS (rediss://).
     *
     * This cannot be added to or removed from an existing cluster. AWS does not allow
     * durability to be enabled or disabled after creation, and the cluster mode change
     * forces the replication group to be replaced.
     */
    haConfig?: ValkeyHaConfig;
}
