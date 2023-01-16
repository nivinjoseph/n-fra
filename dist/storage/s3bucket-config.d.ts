import { S3bucketAccessConfig } from "./s3bucket-access-config";
export interface S3bucketConfig {
    bucketName: string;
    isPublic: boolean;
    enableTransferAcceleration?: boolean;
    accessConfig?: ReadonlyArray<S3bucketAccessConfig>;
}
