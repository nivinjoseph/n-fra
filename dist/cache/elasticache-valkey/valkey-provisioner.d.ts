import { ValkeyConfig } from "./valkey-config.js";
import { ValkeyDetails } from "./valkey-details.js";
export declare class ValkeyProvisioner {
    private static readonly _engineVersion;
    private static readonly _paramGroupFamily;
    /**
     * @description A replication group is capped at 6 cache clusters (1 primary plus 5 replicas),
     * and replicas per node group is capped at 5.
     */
    private static readonly _maxReplicasPerShard;
    /**
     * @description Node type families that support durability.
     * https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Durability.Limitations.html
     */
    private static readonly _durableNodeTypeFamilies;
    private readonly _name;
    private readonly _config;
    constructor(name: string, config: ValkeyConfig);
    provision(): ValkeyDetails;
}
//# sourceMappingURL=valkey-provisioner.d.ts.map