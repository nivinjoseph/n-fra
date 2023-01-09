import * as Pulumi from "@pulumi/pulumi";
export interface AlbDetails {
    [host: string]: {
        albTargetGroupArn: Pulumi.Output<string>;
    };
}
