import { S3bucketDetails } from "./s3bucket-details";


export interface S3bucketAccessPolicyConfig
{
    bucketDetails: S3bucketDetails;
    accessControls: ReadonlyArray<"GET" | "PUT">;
}