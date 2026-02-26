import { RabbitAmazonmqConfig } from "./rabbit-amazonmq-config.js";
import { RabbitAmazonmqDetails } from "./rabbit-amazonmq-details.js";
export declare class RabbitAmazonmqProvisioner {
    private readonly _name;
    private readonly _config;
    constructor(name: string, config: RabbitAmazonmqConfig);
    provision(): RabbitAmazonmqDetails;
    private _createPassword;
}
//# sourceMappingURL=rabbit-amazonmq-provisioner.d.ts.map