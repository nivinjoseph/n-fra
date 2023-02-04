import { VpcDetails } from "../vpc/vpc-details";
import { AlbTarget } from "./alb-target";
export interface AlbConfig {
    vpcDetails: VpcDetails;
    subnetNamePrefix: string;
    egressSubnetNamePrefixes: ReadonlyArray<string>;
    certificateArn?: string;
    enableWaf?: boolean;
    enableCloudfront?: boolean;
    targets: ReadonlyArray<AlbTarget>;
    justAlb?: boolean;
}
