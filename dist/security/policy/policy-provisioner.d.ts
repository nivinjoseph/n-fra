import { PolicyConfig } from "./policy-config";
import { PolicyDetails } from "./policy-details";
export declare class PolicyProvisioner {
    private readonly _name;
    private readonly _config;
    constructor(name: string, config: PolicyConfig);
    provision(): PolicyDetails;
}
