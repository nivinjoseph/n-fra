import * as Pulumi from "@pulumi/pulumi";
export interface LambdaDetails {
    lambdaArn: Pulumi.Output<string>;
    functionName: Pulumi.Output<string>;
}
