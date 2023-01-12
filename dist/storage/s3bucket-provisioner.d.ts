import { S3bucketConfig } from "./s3bucket-config";
import { S3bucketDetails } from "./s3bucket-details";
export declare class S3bucketProvisioner {
    private readonly _name;
    private readonly _config;
    constructor(name: string, config: S3bucketConfig);
    provision(): S3bucketDetails;
}
