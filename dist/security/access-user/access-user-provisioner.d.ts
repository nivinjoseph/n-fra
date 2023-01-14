import { AccessUserDetails } from "./access-user-details";
export declare class AccessUserProvisioner {
    private readonly _name;
    constructor(name: string);
    provision(): AccessUserDetails;
}
