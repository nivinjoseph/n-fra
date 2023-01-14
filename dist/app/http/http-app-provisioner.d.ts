import { AppProvisioner } from "../app-provisioner";
import { HttpAppConfig } from "./http-app-config";
import { HttpAppDetails } from "./http-app-details";
export declare class HttpAppProvisioner extends AppProvisioner<HttpAppConfig> {
    constructor(name: string, config: HttpAppConfig);
    provision(): HttpAppDetails;
}
