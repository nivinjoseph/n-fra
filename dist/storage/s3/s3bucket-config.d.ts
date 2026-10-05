import type { S3bucketAccessConfig } from "./s3bucket-access-config.js";
export interface S3bucketConfig {
    /**
     * Globally unique bucket name (lowercase, 3-63 chars). Also used as the Pulumi name, so renaming replaces the bucket;
     * the bucket is created with `forceDestroy`, so a delete or replace removes every object in it.
     */
    bucketName: string;
    /** `true` allows public reads via a bucket policy; `false` blocks all public access. */
    isPublic: boolean;
    /** Default: `false`. Not allowed when `bucketName` contains a dot. */
    enableTransferAcceleration?: boolean;
    /** Principals granted access through the bucket policy; must be non-empty when provided. */
    accessConfig?: ReadonlyArray<S3bucketAccessConfig>;
    /** Lifecycle rule that expires objects after this many days. Default: objects never expire. */
    objectExpiryDays?: number;
}
//# sourceMappingURL=s3bucket-config.d.ts.map