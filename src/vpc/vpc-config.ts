import type { VpcSubnetConfig } from "./vpc-subnet-config.js";


export interface VpcConfig
{
    /** VPC CIDR block, e.g. `"10.0.0.0/16"`. Every subnet `cidrRange` must fall inside it. */
    cidrRange: string;
    /** Default: `false`. Sends VPC flow logs to a CloudWatch log group. */
    enableVpcFlowLogs?: boolean;
    /** Subnets to create. `SubnetPool.reserveSubnets()` generates valid, non-overlapping entries from the VPC CIDR. */
    subnets: ReadonlyArray<VpcSubnetConfig>;
    /** NAT gateways for private subnets. Default: 3 (one per AZ) when the stack is `prod`, otherwise 1. 0 leaves private subnets without internet egress. */
    numNatGateways?: 0 | 1 | 3;
}