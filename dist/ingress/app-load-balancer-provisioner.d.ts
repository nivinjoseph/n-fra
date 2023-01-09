import { VpcInfo } from "../vpc/vpc-info";
import { AppLoadBalancerConfig } from "./app-load-balancer-config";
import { AppLoadBalancerDetails } from "./app-load-balancer-details";
export declare class AppLoadBalancerProvisioner {
    private readonly _name;
    private readonly _vpcInfo;
    private readonly _config;
    constructor(name: string, vpcInfo: VpcInfo, config: AppLoadBalancerConfig);
    provision(): AppLoadBalancerDetails;
    private _provisionWaf;
    private _provisionCloudFrontDistro;
}
