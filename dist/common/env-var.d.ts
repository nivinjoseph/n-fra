import * as Pulumi from "@pulumi/pulumi";
export interface EnvVar {
    readonly name: string;
    readonly value: string | Pulumi.Output<string>;
}
