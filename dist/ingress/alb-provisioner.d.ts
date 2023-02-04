import { AlbConfig } from "./alb-config";
import { AlbDetails } from "./alb-details";
export declare class AlbProvisioner {
    private readonly _name;
    private readonly _config;
    private readonly _useTls;
    private readonly _onlyDefault;
    constructor(name: string, config: AlbConfig);
    provision(): AlbDetails;
    private _provisionWaf;
    private _provisionCloudFrontDistro;
}
