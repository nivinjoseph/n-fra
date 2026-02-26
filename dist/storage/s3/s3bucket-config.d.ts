import type { S3bucketAccessConfig } from "./s3bucket-access-config.js";
export interface S3bucketConfig {
    bucketName: string;
    isPublic: boolean;
    enableTransferAcceleration?: boolean;
    accessConfig?: ReadonlyArray<S3bucketAccessConfig>;
    objectExpiryDays?: number;
}
//# sourceMappingURL=s3bucket-config.d.ts.map