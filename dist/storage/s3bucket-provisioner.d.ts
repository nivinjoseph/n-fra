import { PolicyDocument } from "../security/policy/policy-document";
import { S3bucketAccessPolicyConfig } from "./s3bucket-access-policy-config";
import { S3bucketConfig } from "./s3bucket-config";
import { S3bucketDetails } from "./s3bucket-details";
export declare class S3bucketProvisioner {
    private readonly _name;
    private readonly _config;
    constructor(name: string, config: S3bucketConfig);
    static createAccessPolicyDocument(config: S3bucketAccessPolicyConfig): PolicyDocument;
    provision(): S3bucketDetails;
}
