import { AppProvisioner } from "../app-provisioner";
import { HttpAppConfig } from "./http-app-config";
import { VpcDetails } from "../../vpc/vpc-details";
export declare class HttpAppProvisioner extends AppProvisioner<HttpAppConfig> {
    constructor(name: string, vpcDetails: VpcDetails, config: HttpAppConfig);
    provision(): void;
}
