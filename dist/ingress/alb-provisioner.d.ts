import { VpcDetails } from "../vpc/vpc-details";
import { AlbConfig } from "./alb-config";
import { AlbDetails } from "./alb-details";
export declare class AlbProvisioner {
    private readonly _name;
    private readonly _vpcDetails;
    private readonly _config;
    constructor(name: string, vpcDetails: VpcDetails, config: AlbConfig);
    provision(): AlbDetails;
    private _provisionWaf;
    private _provisionCloudFrontDistro;
}
