import { MemorydbConfig } from "./memorydb-config.js";
import { MemorydbDetails } from "./memorydb-details.js";
export declare class MemorydbProvisioner {
    private readonly _name;
    private readonly _config;
    constructor(name: string, config: MemorydbConfig);
    provision(): MemorydbDetails;
}
//# sourceMappingURL=memorydb-provisioner.d.ts.map