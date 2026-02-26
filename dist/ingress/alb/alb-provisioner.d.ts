import type { AlbConfig } from "./alb-config.js";
import type { AlbDetails } from "./alb-details.js";
export declare class AlbProvisioner {
    private readonly _name;
    private readonly _config;
    private readonly _useTls;
    private readonly _onlyDefault;
    private readonly _defaultPathPattern;
    constructor(name: string, config: AlbConfig);
    provision(): AlbDetails;
    private _provisionWaf;
    private _provisionCloudFrontDistro;
}
//# sourceMappingURL=alb-provisioner.d.ts.map