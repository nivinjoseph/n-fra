import { AlbTarget } from "./alb-target";


export interface AlbConfig
{
    subnetNamePrefix: string;
    egressSubnetNamePrefixes: ReadonlyArray<string>;
    certificateArn: string;
    enableWaf?: boolean;
    enableCloudfront?: boolean;
    targets: ReadonlyArray<AlbTarget>;
}