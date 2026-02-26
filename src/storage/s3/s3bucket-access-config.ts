import * as Pulumi from "@pulumi/pulumi";


export interface S3bucketAccessConfig
{
    userOrRoleArn?: Pulumi.Output<string>;
    awsService?: string;
    accessControls: ReadonlyArray<"GET" | "PUT">;
}