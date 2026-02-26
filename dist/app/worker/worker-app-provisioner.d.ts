import { AppProvisioner } from "../app-provisioner.js";
import type { WorkerAppConfig } from "./worker-app-config.js";
import type { WorkerAppDetails } from "./worker-app-details.js";
export declare class WorkerAppProvisioner extends AppProvisioner<WorkerAppConfig, WorkerAppDetails> {
    constructor(name: string, config: WorkerAppConfig);
    protected provisionApp(): WorkerAppDetails;
}
//# sourceMappingURL=worker-app-provisioner.d.ts.map