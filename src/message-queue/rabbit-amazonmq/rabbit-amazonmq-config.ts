import type { SubnetNamePrefix } from "../../vpc/vpc-subnet-config.js";
import { VpcDetails } from "../../vpc/vpc-details.js";


export interface RabbitAmazonmqConfig
{
    /** The VPC to deploy into, as returned by `VpcProvisioner.provision()`. */
    vpcDetails: VpcDetails;
    /** Prefix of the VPC subnets the broker is placed in (3 subnets are used when `isHA`, otherwise 1) (matches `VpcSubnetConfig.prefix`; see `SubnetNamePrefix`). */
    subnetNamePrefix: SubnetNamePrefix;
    /** Prefixes of the subnets whose CIDR ranges may reach the AMQP and console ports; they become the security group's ingress rules. */
    ingressSubnetNamePrefixes: ReadonlyArray<SubnetNamePrefix>;
    /** Broker size; see `RabbitAmazonmqInstanceType` for the `mq.m5.*` class each maps to. */
    instanceType: RabbitAmazonmqInstanceType;
    /** Admin username. Default: `"appuser"`. */
    username?: string;
    /** Admin password. Default: generated randomly and returned as an Output in the details. */
    password?: string;
    /** Default: `false`. Deploys a 3-node cluster across 3 subnets instead of a single instance. */
    isHA?: boolean;
}


export enum RabbitAmazonmqInstanceType
{
    small = "mq.m5.large",
    medium = "mq.m5.xlarge",
    large = "mq.m5.2xlarge",
    xlarge = "mq.m5.4xlarge"
}