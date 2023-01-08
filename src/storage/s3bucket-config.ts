import * as Pulumi from "@pulumi/pulumi";


export interface S3bucketConfig
{
    bucketName: string;
    isPublic: boolean;
    enableTransferAcceleration?: boolean;
    accessUserArn?: Pulumi.Output<string>;
}