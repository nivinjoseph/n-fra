import { AppProvisioner } from "../app-provisioner";
import { VpcDetails } from "../../vpc/vpc-details";
import { WorkerAppConfig } from "./worker-app-config";
export declare class WorkerAppProvisioner extends AppProvisioner<WorkerAppConfig> {
    constructor(name: string, vpcDetails: VpcDetails, config: WorkerAppConfig);
    provision(): void;
}
