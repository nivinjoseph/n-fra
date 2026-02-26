import { VpcDetails } from "../../vpc/vpc-details.js";
import * as Pulumi from "@pulumi/pulumi";
export interface NlbConfig {
    vpcDetails: VpcDetails;
    subnetNamePrefix: string;
    port: number;
    targetIp: Pulumi.Input<string>;
}
//# sourceMappingURL=nlb-config.d.ts.map