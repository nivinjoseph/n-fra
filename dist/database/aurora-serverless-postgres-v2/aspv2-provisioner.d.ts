import { VpcInfo } from "../../vpc/vpc-info";
import { Aspv2Config } from "./aspv2-config";
import { Aspv2Details } from "./aspv2-details";
export declare class Aspv2Provisioner {
    private readonly _name;
    private readonly _vpcInfo;
    private readonly _config;
    constructor(name: string, vpcInfo: VpcInfo, config: Aspv2Config);
    provision(): Aspv2Details;
}
