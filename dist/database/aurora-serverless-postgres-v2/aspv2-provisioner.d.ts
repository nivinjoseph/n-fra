import { Aspv2Config } from "./aspv2-config.js";
import { Aspv2Details } from "./aspv2-details.js";
export declare class Aspv2Provisioner {
    private readonly _name;
    private readonly _config;
    constructor(name: string, config: Aspv2Config);
    provision(): Aspv2Details;
    private _createPassword;
}
//# sourceMappingURL=aspv2-provisioner.d.ts.map