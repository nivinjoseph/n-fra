import * as Pulumi from "@pulumi/pulumi";
export interface AccessKeyDetails {
    userArn: Pulumi.Output<string>;
    accessKeyId: Pulumi.Output<string>;
    accessKeySecret: Pulumi.Output<string>;
}
