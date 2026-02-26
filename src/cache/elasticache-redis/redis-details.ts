import * as Pulumi from "@pulumi/pulumi";


export interface RedisDetails
{
    host: Pulumi.Output<string>;
    port: number;
}