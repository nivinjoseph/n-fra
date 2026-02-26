import * as pulumi from "@pulumi/pulumi";
export interface Secret {
    readonly name: string;
    readonly arn: pulumi.Output<string>;
}
//# sourceMappingURL=secret.d.ts.map