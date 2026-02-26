import * as Pulumi from "@pulumi/pulumi";
import type { Secret } from "./secret.js";
export declare class SecretProvisioner {
    provision(name: string, value: string | Pulumi.Output<string>): Secret;
}
//# sourceMappingURL=secret-provisioner.d.ts.map