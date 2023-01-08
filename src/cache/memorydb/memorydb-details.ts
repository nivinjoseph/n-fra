import * as Pulumi from "@pulumi/pulumi";


export interface MemorydbDetails
{
    endpoints: Pulumi.Output<string>;
}