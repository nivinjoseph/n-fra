import { VpcDetails } from "../../vpc/vpc-details";
import { MemorydbConfig } from "./memorydb-config";
import { MemorydbDetails } from "./memorydb-details";
export declare class MemorydbProvisioner {
    private readonly _name;
    private readonly _vpcDetails;
    private readonly _config;
    constructor(name: string, vpcDetails: VpcDetails, config: MemorydbConfig);
    provision(): MemorydbDetails;
}
