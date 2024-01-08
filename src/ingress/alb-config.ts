import { VpcDetails } from "../vpc/vpc-details.js";
import { AlbTarget } from "./alb-target.js";


export interface AlbConfig
{
    vpcDetails: VpcDetails;
    subnetNamePrefix: string;
    egressSubnetNamePrefixes: ReadonlyArray<string>;
    certificateArn?: string;
    enableWaf?: boolean;
    enableCloudfront?: boolean;
    targets: ReadonlyArray<AlbTarget>;
    justAlb?: boolean;
}