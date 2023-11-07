import * as Pulumi from "@pulumi/pulumi";
export interface AlbDetails {
    dnsName: Pulumi.Output<string>;
    hostTargets: {
        [host: string]: {
            albTargetGroupArn: Pulumi.Output<string>;
        };
    };
}
