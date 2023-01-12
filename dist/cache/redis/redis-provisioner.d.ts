import { VpcDetails } from "../../vpc/vpc-details";
import { RedisConfig } from "./redis-config";
import { RedisDetails } from "./redis-details";
export declare class RedisProvisioner {
    private readonly _name;
    private readonly _vpcDetails;
    private readonly _config;
    constructor(name: string, vpcDetails: VpcDetails, config: RedisConfig);
    provision(): RedisDetails;
}
