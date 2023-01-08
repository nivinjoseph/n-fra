import { VpcInfo } from "../../vpc/vpc-info";
import { MemorydbConfig } from "./memorydb-config";
import { MemorydbDetails } from "./memorydb-details";
export declare class MemorydbProvisioner {
    private readonly _name;
    private readonly _vpcInfo;
    private readonly _config;
    constructor(name: string, vpcInfo: VpcInfo, config: MemorydbConfig);
    provision(): MemorydbDetails;
}
