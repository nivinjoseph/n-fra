import { RedisConfig } from "./redis-config.js";
import { RedisDetails } from "./redis-details.js";
export declare class RedisProvisioner {
    private readonly _name;
    private readonly _config;
    constructor(name: string, config: RedisConfig);
    provision(): RedisDetails;
}
//# sourceMappingURL=redis-provisioner.d.ts.map