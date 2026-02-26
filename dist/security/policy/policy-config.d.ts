import * as Pulumi from "@pulumi/pulumi";
import type { PolicyDocument } from "./policy-document.js";
export interface PolicyConfig {
    document: PolicyDocument;
    userName?: Pulumi.Output<string>;
    roleName?: Pulumi.Output<string>;
}
//# sourceMappingURL=policy-config.d.ts.map