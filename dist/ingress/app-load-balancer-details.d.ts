import * as Pulumi from "@pulumi/pulumi";
export interface AppLoadBalancerDetails {
    [host: string]: {
        albTargetGroupArn: Pulumi.Output<string>;
    };
}
