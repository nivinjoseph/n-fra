import { VpcDetails } from "../vpc/vpc-details";
import { AppLoadBalancerConfig } from "./app-load-balancer-config";
import { AppLoadBalancerDetails } from "./app-load-balancer-details";
export declare class AppLoadBalancerProvisioner {
    private readonly _name;
    private readonly _vpcDetails;
    private readonly _config;
    constructor(name: string, vpcDetails: VpcDetails, config: AppLoadBalancerConfig);
    provision(): AppLoadBalancerDetails;
    private _provisionWaf;
    private _provisionCloudFrontDistro;
}
