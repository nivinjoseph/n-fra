import * as Pulumi from "@pulumi/pulumi";


export interface ValkeyDetails
{
    host: Pulumi.Output<string>;
    port: number;
}