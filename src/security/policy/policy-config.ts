import * as Pulumi from "@pulumi/pulumi";
import type { PolicyDocument } from "./policy-document.js";


export interface PolicyConfig
{
    /** The IAM policy to create. */
    document: PolicyDocument;
    /** IAM user to attach the policy to, e.g. `AccessUserDetails.userName`. */
    userName?: Pulumi.Output<string>;
    /** IAM role to attach the policy to. */
    roleName?: Pulumi.Output<string>;
}