import type { SubnetNamePrefix } from "../../vpc/vpc-subnet-config.js";
import { PolicyDocument } from "../../security/policy/policy-document.js";
import { VpcDetails } from "../../vpc/vpc-details.js";
import * as Pulumi from "@pulumi/pulumi";


export interface WindowsBastionConfig
{
    /** The VPC to deploy into, as returned by `VpcProvisioner.provision()`. */
    vpcDetails: VpcDetails;
    /** Prefix of the VPC subnets the instance is placed in (public, for RDP access) (matches `VpcSubnetConfig.prefix`; see `SubnetNamePrefix`). */
    subnetNamePrefix: SubnetNamePrefix;
    /** Prefixes of the subnets allowed to reach RDP. Default: open to `0.0.0.0/0`. */
    ingressSubnetNamePrefixes?: ReadonlyArray<SubnetNamePrefix>;
    /** Size preset mapped to an EC2 type (`small` is `t3.medium`). */
    instanceType: "small" | "medium" | "large" | "xlarge";
    /** Root volume size in GB. */
    volumeSize: number;
    /** PowerShell user data run at first boot. */
    userData?: Pulumi.Input<string>;
    /** Default: `false`. `true` replaces the instance whenever `userData` changes. */
    userDataReplaceOnChange?: boolean;
    /** IAM permissions for the instance role: inline `PolicyDocument`s or AWS managed policy ARNs. */
    policies?: ReadonlyArray<PolicyDocument | string>;
}