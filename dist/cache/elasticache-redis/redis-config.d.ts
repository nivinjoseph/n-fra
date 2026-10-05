import type { SubnetNamePrefix } from "../../vpc/vpc-subnet-config.js";
import { VpcDetails } from "../../vpc/vpc-details.js";
export interface RedisConfig {
    /** The VPC to deploy into, as returned by `VpcProvisioner.provision()`. */
    vpcDetails: VpcDetails;
    /** Prefix of the VPC subnets the cache subnet group spans (matches `VpcSubnetConfig.prefix`; see `SubnetNamePrefix`). */
    subnetNamePrefix: SubnetNamePrefix;
    /** Prefixes of the subnets whose CIDR ranges may reach port 6379; they become the security group's ingress rules. */
    ingressSubnetNamePrefixes: ReadonlyArray<SubnetNamePrefix>;
    /**
     * @description Supported node types https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/CacheNodes.SupportedTypes.html
     */
    nodeType: string;
    /** Default: `false`. Adds a replica with automatic failover. TLS is off on this engine. */
    isHA?: boolean;
}
//# sourceMappingURL=redis-config.d.ts.map