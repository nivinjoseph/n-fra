import * as Pulumi from "@pulumi/pulumi";


export interface RabbitAmazonmqDetails
{
    host: Pulumi.Output<string>;
    port: number;
    username: Pulumi.Output<string>;
    password: Pulumi.Output<string>;
}