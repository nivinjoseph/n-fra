import type { SubnetNamePrefix } from "../../vpc/vpc-subnet-config.js";
import { VpcDetails } from "../../vpc/vpc-details.js";
export interface KafkaMskProvisionedConfig {
    /** The VPC to deploy into, as returned by `VpcProvisioner.provision()`. */
    vpcDetails: VpcDetails;
    /** Prefix of the VPC subnets the brokers are placed in; the first `numBrokers` matching subnets are used (matches `VpcSubnetConfig.prefix`; see `SubnetNamePrefix`). */
    subnetNamePrefix: SubnetNamePrefix;
    /** Prefixes of the subnets whose CIDR ranges may reach the brokers; they become the security group's ingress rules. */
    ingressSubnetNamePrefixes: ReadonlyArray<SubnetNamePrefix>;
    /** Broker count; needs at least that many subnets under `subnetNamePrefix`, in distinct AZs. */
    numBrokers: 2 | 3;
    /** MSK broker class, e.g. `"kafka.t3.small"`. */
    instanceClass: string;
    /** EBS storage per broker in GB, 1-16384. */
    storageGb: number;
    /** Default: `false`. Enables public access to the brokers. */
    makePublic?: boolean;
}
//# sourceMappingURL=kafka-msk-provisioned-config.d.ts.map