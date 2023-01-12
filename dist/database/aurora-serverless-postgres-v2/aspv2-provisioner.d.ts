import { VpcDetails } from "../../vpc/vpc-details";
import { Aspv2Config } from "./aspv2-config";
import { Aspv2Details } from "./aspv2-details";
export declare class Aspv2Provisioner {
    private readonly _name;
    private readonly _vpcDetails;
    private readonly _config;
    constructor(name: string, vpcDetails: VpcDetails, config: Aspv2Config);
    provision(): Aspv2Details;
}
