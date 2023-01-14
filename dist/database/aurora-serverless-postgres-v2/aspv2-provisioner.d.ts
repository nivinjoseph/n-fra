import { Aspv2Config } from "./aspv2-config";
import { Aspv2Details } from "./aspv2-details";
export declare class Aspv2Provisioner {
    private readonly _name;
    private readonly _config;
    constructor(name: string, config: Aspv2Config);
    provision(): Aspv2Details;
}
