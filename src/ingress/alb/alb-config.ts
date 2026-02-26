import type { VpcDetails } from "../../vpc/vpc-details.js";
import type { AlbTarget } from "./alb-target.js";


export interface AlbConfig
{
    vpcDetails: VpcDetails;
    subnetNamePrefix: string;
    egressSubnetNamePrefixes: ReadonlyArray<string>;
    certificateArn?: string;
    enableWaf?: boolean;
    enableWafCloudWatchMetrics?: boolean;
    enableCloudfront?: boolean;
    targets: ReadonlyArray<AlbTarget>;
    justAlb?: boolean;
    tags?: object;
    isPrivate?: boolean;
    ingressSubnetNamePrefixes?: ReadonlyArray<string>;
}