import * as pulumi from "@pulumi/pulumi";


export interface AppSecret
{
    readonly name: string;
    readonly arn: pulumi.Output<string>;
}