import type { S3bucketConfig } from "./s3bucket-config.js";
import { S3bucketDetails } from "./s3bucket-details.js";
export declare class S3bucketProvisioner {
    private readonly _name;
    private readonly _config;
    constructor(name: string, config: S3bucketConfig);
    provision(): S3bucketDetails;
}
//# sourceMappingURL=s3bucket-provisioner.d.ts.map