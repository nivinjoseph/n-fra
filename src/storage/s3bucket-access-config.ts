import * as Pulumi from "@pulumi/pulumi";
import { S3bucketDetails } from "./s3bucket-details";


export interface S3bucketAccessConfig
{
    bucketDetails: S3bucketDetails;
    userOrRoleArn?: Pulumi.Output<string>;
    awsService?: string;
    accessControls: ReadonlyArray<"GET" | "PUT">;
}