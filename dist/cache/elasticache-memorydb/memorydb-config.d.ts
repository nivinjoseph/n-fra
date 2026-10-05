import type { SubnetNamePrefix } from "../../vpc/vpc-subnet-config.js";
import { VpcDetails } from "../../vpc/vpc-details.js";
export interface MemorydbConfig {
    /** The VPC to deploy into, as returned by `VpcProvisioner.provision()`. */
    vpcDetails: VpcDetails;
    /** Prefix of the VPC subnets the MemoryDB subnet group spans (matches `VpcSubnetConfig.prefix`; see `SubnetNamePrefix`). */
    subnetNamePrefix: SubnetNamePrefix;
    /** Prefixes of the subnets whose CIDR ranges may reach port 6379; they become the security group's ingress rules. */
    ingressSubnetNamePrefixes: ReadonlyArray<SubnetNamePrefix>;
    /**
     * @description Supported node types https://docs.aws.amazon.com/memorydb/latest/devguide/nodes.supportedtypes.html
     */
    nodeType: string;
    /** Default: 1. Replicas per shard are 1 when the stack is `prod`, otherwise 0. */
    numShards?: number;
}
//# sourceMappingURL=memorydb-config.d.ts.map