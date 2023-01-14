import * as Pulumi from "@pulumi/pulumi";
export interface S3bucketDetails {
    bucketId: Pulumi.Output<string>;
    bucketArn: Pulumi.Output<string>;
}
