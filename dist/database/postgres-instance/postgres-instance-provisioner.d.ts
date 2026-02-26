import { PostgresInstanceConfig } from "./postgres-instance-config.js";
import { PostgresInstanceDetails } from "./postgres-instance-details.js";
export declare class PostgresInstanceProvisioner {
    private readonly _name;
    private readonly _config;
    constructor(name: string, config: PostgresInstanceConfig);
    provision(): PostgresInstanceDetails;
    private _createPassword;
}
//# sourceMappingURL=postgres-instance-provisioner.d.ts.map