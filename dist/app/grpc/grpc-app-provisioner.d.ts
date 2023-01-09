import { AppProvisioner } from "../app-provisioner";
import { VpcDetails } from "../../vpc/vpc-details";
import { GrpcAppConfig } from "./grpc-app-config";
export declare class GrpcAppProvisioner extends AppProvisioner<GrpcAppConfig> {
    constructor(name: string, vpcDetails: VpcDetails, config: GrpcAppConfig);
    provision(): void;
}
