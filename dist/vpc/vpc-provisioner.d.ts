import { VpcSubnetArgs, VpcSubnetType } from "@pulumi/awsx/ec2";
import { VpcAz } from "./vpc-az";
import { VpcConfig } from "./vpc-config";
import { VpcDetails } from "./vpc-details";
export declare abstract class VpcProvisioner {
    private readonly _name;
    private readonly _config;
    private _vpc;
    private _serviceMesh;
    private _pvtDnsNsp;
    protected constructor(name: string, config: VpcConfig);
    provision(): VpcDetails;
    /**
     * @summary keep this implementation idempotent
     */
    protected abstract defineSubnets(): Array<VpcSubnetArgs>;
    protected createSubnet(name: string, type: VpcSubnetType, cidrOctet3: number, az: VpcAz): VpcSubnetArgs;
    private _provisionVpcFlowLogs;
}
