import { Aspv1Config } from "./aspv1-config";
import { Aspv1Details } from "./aspv1-details";
export declare class Aspv1Provisioner {
    private readonly _name;
    private readonly _config;
    constructor(name: string, config: Aspv1Config);
    provision(): Aspv1Details;
}
