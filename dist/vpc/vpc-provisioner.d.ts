import { VpcConfig } from "./vpc-config";
import { VpcDetails } from "./vpc-details";
export declare class VpcProvisioner {
    private readonly _name;
    private readonly _config;
    private _vpc;
    private _serviceMesh;
    private _pvtDnsNsp;
    constructor(name: string, config: VpcConfig);
    provision(): VpcDetails;
    private _createSubnet;
    private _provisionVpcFlowLogs;
}
