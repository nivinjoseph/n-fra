import { AppProvisioner } from "../app-provisioner";
import { HttpAppConfig } from "./http-app-config";
import { VpcInfo } from "../../vpc/vpc-info";
export declare class HttpAppProvisioner extends AppProvisioner<HttpAppConfig> {
    constructor(name: string, vpcInfo: VpcInfo, config: HttpAppConfig);
    provision(): void;
}
