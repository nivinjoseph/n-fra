import * as Pulumi from "@pulumi/pulumi";
import { Secret } from "../../secret/secret.js";
export interface AccessUserDetails {
    userName: Pulumi.Output<string>;
    userArn: Pulumi.Output<string>;
    accessKeyId: Pulumi.Output<string>;
    accessKeySecret: Pulumi.Output<string>;
}
export interface AccessCredentials {
    accessKeyId: Secret;
    secretAccessKey: Secret;
}
//# sourceMappingURL=access-user-details.d.ts.map