import { VpcInfo } from "../../vpc/vpc-info";
import { Aspv1Config } from "./aspv1-config";
import { Aspv1Details } from "./aspv1-details";
export declare class Aspv1Provisioner {
    private readonly _name;
    private readonly _vpcInfo;
    private readonly _config;
    constructor(name: string, vpcInfo: VpcInfo, config: Aspv1Config);
    provision(): Aspv1Details;
}
