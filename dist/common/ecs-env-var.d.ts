import * as Pulumi from "@pulumi/pulumi";
export interface EcsEnvVar {
    readonly name: string;
    readonly value: string | Pulumi.Output<string>;
}
