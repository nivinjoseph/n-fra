import { VpcInfo } from "../../vpc/vpc-info";
import { RedisConfig } from "./redis-config";
import { RedisDetails } from "./redis-details";
export declare class RedisProvisioner {
    private readonly _name;
    private readonly _vpcInfo;
    private readonly _config;
    constructor(name: string, vpcInfo: VpcInfo, config: RedisConfig);
    provision(): RedisDetails;
}
