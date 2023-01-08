import { AccessKeyDetails } from "./access-key-details";
export declare class AccessKeyProvisioner {
    private readonly _name;
    constructor(name: string);
    provision(): AccessKeyDetails;
}
