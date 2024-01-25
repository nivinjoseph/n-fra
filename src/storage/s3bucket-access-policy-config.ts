import { S3bucketDetails } from "./s3bucket-details.js";


export interface S3bucketAccessPolicyConfig
{
    bucketDetails: S3bucketDetails;
    accessControls: ReadonlyArray<"GET" | "PUT">;
}