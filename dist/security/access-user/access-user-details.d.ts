import * as Pulumi from "@pulumi/pulumi";
export interface AccessUserDetails {
    userArn: Pulumi.Output<string>;
    accessKeyId: Pulumi.Output<string>;
    accessKeySecret: Pulumi.Output<string>;
}
