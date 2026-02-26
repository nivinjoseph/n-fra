import type { PolicyConfig } from "./policy-config.js";
import type { PolicyDetails } from "./policy-details.js";
export declare class PolicyProvisioner {
    private readonly _name;
    private readonly _config;
    constructor(name: string, config: PolicyConfig);
    provision(): PolicyDetails;
}
//# sourceMappingURL=policy-provisioner.d.ts.map