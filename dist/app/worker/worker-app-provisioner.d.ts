import { AppProvisioner } from "../app-provisioner";
import { WorkerAppConfig } from "./worker-app-config";
import { WorkerAppDetails } from "./worker-app-details";
export declare class WorkerAppProvisioner extends AppProvisioner<WorkerAppConfig> {
    constructor(name: string, config: WorkerAppConfig);
    provision(): WorkerAppDetails;
}
