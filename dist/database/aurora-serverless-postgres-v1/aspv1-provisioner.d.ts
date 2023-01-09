import { VpcDetails } from "../../vpc/vpc-details";
import { Aspv1Config } from "./aspv1-config";
import { Aspv1Details } from "./aspv1-details";
export declare class Aspv1Provisioner {
    private readonly _name;
    private readonly _vpcDetails;
    private readonly _config;
    constructor(name: string, vpcDetails: VpcDetails, config: Aspv1Config);
    provision(): Aspv1Details;
}
