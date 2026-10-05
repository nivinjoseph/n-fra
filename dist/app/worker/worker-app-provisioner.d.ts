import { AppProvisioner } from "../app-provisioner.js";
import type { WorkerAppConfig } from "./worker-app-config.js";
import type { WorkerAppDetails } from "./worker-app-details.js";
/**
 * Fargate service for a background worker with no ingress. Container contract: answer `GET /healthCheck` on port 8080
 * with 2xx; the image must contain `curl`, which the ECS health check runs against `localhost:8080`.
 */
export declare class WorkerAppProvisioner extends AppProvisioner<WorkerAppConfig, WorkerAppDetails> {
    private static readonly _probeTimeoutSeconds;
    constructor(name: string, config: WorkerAppConfig);
    protected provisionApp(): WorkerAppDetails;
}
//# sourceMappingURL=worker-app-provisioner.d.ts.map