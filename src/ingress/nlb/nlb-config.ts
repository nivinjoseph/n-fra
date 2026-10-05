import type { SubnetNamePrefix } from "../../vpc/vpc-subnet-config.js";
import { VpcDetails } from "../../vpc/vpc-details.js";
import * as Pulumi from "@pulumi/pulumi";


export interface NlbConfig
{
    /** The VPC to deploy into, as returned by `VpcProvisioner.provision()`. */
    vpcDetails: VpcDetails;
    /** Prefix of the VPC subnets the network load balancer is placed in (matches `VpcSubnetConfig.prefix`; see `SubnetNamePrefix`). */
    subnetNamePrefix: SubnetNamePrefix;
    /** TCP port the listener accepts and forwards to `targetIp`. */
    port: number;
    /** IP address of the single target behind the NLB. */
    targetIp: Pulumi.Input<string>;
}