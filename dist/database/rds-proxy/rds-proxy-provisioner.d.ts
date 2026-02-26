import { RdsProxyConfig } from "./rds-proxy-config.js";
import { RdsProxyDetails } from "./rds-proxy-details.js";
export declare class RdsProxyProvisioner {
    private readonly _name;
    private readonly _config;
    constructor(name: string, config: RdsProxyConfig);
    provision(): RdsProxyDetails;
}
//# sourceMappingURL=rds-proxy-provisioner.d.ts.map