import * as Pulumi from "@pulumi/pulumi";


export interface AppClusterDetails
{
    clusterName: Pulumi.Output<string>;
    clusterArn: Pulumi.Output<string>;
}