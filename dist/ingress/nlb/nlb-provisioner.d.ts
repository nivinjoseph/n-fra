import { NlbConfig } from "./nlb-config.js";
import { NlbDetails } from "./nlb-details.js";
export declare class NlbProvisioner {
    private readonly _name;
    private readonly _config;
    constructor(name: string, config: NlbConfig);
    provision(): NlbDetails;
}
//# sourceMappingURL=nlb-provisioner.d.ts.map