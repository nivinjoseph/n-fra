import { MariaInstanceConfig } from "./maria-instance-config.js";
import { MariaInstanceDetails } from "./maria-instance-details.js";
export declare class MariaInstanceProvisioner {
    private readonly _name;
    private readonly _config;
    constructor(name: string, config: MariaInstanceConfig);
    provision(): MariaInstanceDetails;
    private _createPassword;
}
//# sourceMappingURL=maria-instance-provisioner.d.ts.map