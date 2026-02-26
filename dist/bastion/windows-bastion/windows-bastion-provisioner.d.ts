import { WindowsBastionConfig } from "./windows-bastion-config.js";
import { WindowsBastionDetails } from "./windows-bastion-details.js";
export declare class WindowsBastionProvisioner {
    private readonly _name;
    private readonly _config;
    private readonly _instanceType;
    constructor(name: string, config: WindowsBastionConfig);
    provision(): Promise<WindowsBastionDetails>;
    private _createIamInstanceProfile;
}
//# sourceMappingURL=windows-bastion-provisioner.d.ts.map