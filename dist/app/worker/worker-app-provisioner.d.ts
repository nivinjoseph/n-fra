import { AppProvisioner } from "../app-provisioner";
import { VpcInfo } from "../../vpc/vpc-info";
import { WorkerAppConfig } from "./worker-app-config";
export declare class WorkerAppProvisioner extends AppProvisioner<WorkerAppConfig> {
    constructor(name: string, vpcInfo: VpcInfo, config: WorkerAppConfig);
    provision(): void;
}
