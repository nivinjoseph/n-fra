import { EfsConfig } from "./efs-config.js";
import { EfsDetails } from "./efs-details.js";
export declare class EfsProvisioner {
    private readonly _name;
    private readonly _config;
    constructor(name: string, config: EfsConfig);
    provision(): EfsDetails;
}
//# sourceMappingURL=efs-provisioner.d.ts.map