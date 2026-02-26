import type { VpcConfig } from "./vpc-config.js";
import { VpcDetails } from "./vpc-details.js";
export declare class VpcProvisioner {
    private readonly _name;
    private readonly _config;
    private _vpcName;
    private _vpc;
    private _igw;
    private readonly _subnets;
    private readonly _ngws;
    private _pvtDnsName;
    private _pvtDnsNsp;
    constructor(name: string, config: VpcConfig);
    provision(): VpcDetails;
    private _createSubnet;
    private _createNatGateway;
    private _createDefaultSecurityGroup;
    private _provisionVpcFlowLogs;
    private _createPrivateDnsNamespace;
    private _createVpcS3GatewayEndpoint;
}
//# sourceMappingURL=vpc-provisioner.d.ts.map