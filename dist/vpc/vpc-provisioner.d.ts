import { Mesh } from "@pulumi/aws/appmesh";
import { PrivateDnsNamespace } from "@pulumi/aws/servicediscovery";
import { VpcSubnetArgs, VpcSubnetType, Vpc } from "@pulumi/awsx/ec2";
import { VpcAz } from "./vpc-az";
import { VpcInfo } from "./vpc-info";
export declare abstract class VpcProvisioner implements VpcInfo {
    private readonly _name;
    private readonly _enableVpcFlowLogs;
    private readonly _cidrNet;
    private _vpc;
    private _serviceMesh;
    private _pvtDnsNsp;
    get vpc(): Vpc;
    get serviceMesh(): Mesh;
    get privateDnsNamespace(): PrivateDnsNamespace;
    protected constructor(name: string, enableVpcFlowLogs?: boolean);
    provision(): void;
    /**
     * @summary keep this implementation idempotent
     */
    protected abstract defineSubnets(): Array<VpcSubnetArgs>;
    protected createSubnet(name: string, type: VpcSubnetType, cidrNumber: number, az: VpcAz): VpcSubnetArgs;
    private _calculateCidrNet;
    private _provisionVpcFlowLogs;
}
