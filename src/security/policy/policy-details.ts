import * as Pulumi from "@pulumi/pulumi";


export interface PolicyDetails
{
    policyArn: Pulumi.Output<string>;
}