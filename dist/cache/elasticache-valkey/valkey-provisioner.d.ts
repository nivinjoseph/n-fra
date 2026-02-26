import { ValkeyConfig } from "./valkey-config.js";
import { ValkeyDetails } from "./valkey-details.js";
export declare class ValkeyProvisioner {
    private readonly _name;
    private readonly _config;
    constructor(name: string, config: ValkeyConfig);
    provision(): ValkeyDetails;
}
//# sourceMappingURL=valkey-provisioner.d.ts.map