import { AppLoadBalancerTarget } from "./app-load-balancer-target";


export interface AppLoadBalancerConfig
{
    subnetNamePrefix: string;
    egressSubnetNamePrefixes: ReadonlyArray<string>;
    certificateArn: string;
    enableWaf?: boolean;
    enableCloudfront?: boolean;
    targets: ReadonlyArray<AppLoadBalancerTarget>;
}