import { RedisConfig } from "./redis-config";
import { RedisDetails } from "./redis-details";
export declare class RedisProvisioner {
    private readonly _name;
    private readonly _config;
    constructor(name: string, config: RedisConfig);
    provision(): RedisDetails;
}
