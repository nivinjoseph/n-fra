import { KafkaMskServerlessConfig } from "./kafka-msk-serverless-config.js";
import { KafkaMskServerlessDetails } from "./kafka-msk-serverless-details.js";
export declare class KafkaMskServerlessProvisioner {
    private readonly _name;
    private readonly _config;
    constructor(name: string, config: KafkaMskServerlessConfig);
    provision(): KafkaMskServerlessDetails;
}
//# sourceMappingURL=kafka-msk-serverless-provisioner.d.ts.map