import { AppProvisioner } from "../app-provisioner.js";
import type { HttpAppConfig } from "./http-app-config.js";
import type { HttpAppDetails } from "./http-app-details.js";
/**
 * Fargate service for an HTTP app behind an ALB. Container contract: listen on port 80 (or `defaultAppPortOverride`) and
 * answer `GET /healthCheck` with 2xx; the image must contain `curl`, which the ECS health check runs against `localhost`.
 */
export declare class HttpAppProvisioner extends AppProvisioner<HttpAppConfig, HttpAppDetails> {
    private static readonly _probeTimeoutSeconds;
    constructor(name: string, config: HttpAppConfig);
    protected provisionApp(): HttpAppDetails;
}
//# sourceMappingURL=http-app-provisioner.d.ts.map