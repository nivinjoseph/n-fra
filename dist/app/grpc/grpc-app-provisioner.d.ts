import { AppProvisioner } from "../app-provisioner";
import { VpcInfo } from "../../vpc/vpc-info";
import { GrpcAppConfig } from "./grpc-app-config";
export declare class GrpcAppProvisioner extends AppProvisioner<GrpcAppConfig> {
    constructor(name: string, vpcInfo: VpcInfo, config: GrpcAppConfig);
    provision(): void;
}
