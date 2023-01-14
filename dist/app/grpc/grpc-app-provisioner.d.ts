import { AppProvisioner } from "../app-provisioner";
import { GrpcAppConfig } from "./grpc-app-config";
import { GrpcAppDetails } from "./grpc-app-details";
export declare class GrpcAppProvisioner extends AppProvisioner<GrpcAppConfig> {
    constructor(name: string, config: GrpcAppConfig);
    provision(): GrpcAppDetails;
}
