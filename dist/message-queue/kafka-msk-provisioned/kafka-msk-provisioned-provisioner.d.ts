import { KafkaMskProvisionedConfig } from "./kafka-msk-provisioned-config.js";
import { KafkaMskProvisionedDetails } from "./kafka-msk-provisioned-details.js";
export declare class KafkaMskProvisionedProvisioner {
    private readonly _name;
    private readonly _config;
    constructor(name: string, config: KafkaMskProvisionedConfig);
    provision(): KafkaMskProvisionedDetails;
}
//# sourceMappingURL=kafka-msk-provisioned-provisioner.d.ts.map