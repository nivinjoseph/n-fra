import { MemorydbConfig } from "./memorydb-config";
import { MemorydbDetails } from "./memorydb-details";
export declare class MemorydbProvisioner {
    private readonly _name;
    private readonly _config;
    constructor(name: string, config: MemorydbConfig);
    provision(): MemorydbDetails;
}
