import * as Pulumi from "@pulumi/pulumi";
export interface S3bucketAccessConfig {
    /** IAM user or role ARN to grant access to, e.g. `AccessUserDetails.userArn`. Give this or `awsService`. */
    userOrRoleArn?: Pulumi.Output<string>;
    /** AWS service principal to grant access to, e.g. `"cloudfront.amazonaws.com"`. Give this or `userOrRoleArn`. */
    awsService?: string;
    /** `"GET"` grants object reads, `"PUT"` grants object writes. */
    accessControls: ReadonlyArray<"GET" | "PUT">;
}
//# sourceMappingURL=s3bucket-access-config.d.ts.map