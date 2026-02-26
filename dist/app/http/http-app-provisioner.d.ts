import { AppProvisioner } from "../app-provisioner.js";
import type { HttpAppConfig } from "./http-app-config.js";
import type { HttpAppDetails } from "./http-app-details.js";
export declare class HttpAppProvisioner extends AppProvisioner<HttpAppConfig, HttpAppDetails> {
    constructor(name: string, config: HttpAppConfig);
    protected provisionApp(): HttpAppDetails;
}
//# sourceMappingURL=http-app-provisioner.d.ts.map