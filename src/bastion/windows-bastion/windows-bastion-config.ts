import { PolicyDocument } from "../../security/policy/policy-document.js";
import { VpcDetails } from "../../vpc/vpc-details.js";
import * as Pulumi from "@pulumi/pulumi";


export interface WindowsBastionConfig
{
    vpcDetails: VpcDetails;
    subnetNamePrefix: string;
    ingressSubnetNamePrefixes?: ReadonlyArray<string>;
    instanceType: "small" | "medium" | "large" | "xlarge";
    volumeSize: number;
    userData?: Pulumi.Input<string>;
    userDataReplaceOnChange?: boolean;
    policies?: ReadonlyArray<PolicyDocument | string>;
}