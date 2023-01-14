import { PolicyDocument } from "../security/policy/policy-document";
import { S3bucketAccessConfig } from "./s3bucket-access-config";
import { S3bucketConfig } from "./s3bucket-config";
import { S3bucketDetails } from "./s3bucket-details";
export declare class S3bucketProvisioner {
    private readonly _name;
    private readonly _config;
    constructor(name: string, config: S3bucketConfig);
    static provisionAccess(name: string, config: S3bucketAccessConfig): void;
    static createAccessPolicyDocument(config: Pick<S3bucketAccessConfig, "bucketDetails" | "accessControls">): PolicyDocument;
    provision(): S3bucketDetails;
}
