import * as Pulumi from "@pulumi/pulumi";
import { Secret } from "./secret";
export declare class SecretsProvisioner {
    provision(name: string, value: string | Pulumi.Output<string>): Secret;
}
