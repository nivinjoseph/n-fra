import { AppDatadogConfig } from "./app-datadog-config.js";
import { EnvVar } from "../common/env-var.js";
import { Secret } from "../secrets/secret.js";
import { PolicyDocument } from "../security/policy/policy-document.js";
import { VpcDetails } from "../vpc/vpc-details.js";
import { AppClusterDetails } from "./app-cluster-details.js";


export interface AppConfig
{
    vpcDetails: VpcDetails;
    subnetNamePrefix: string;
    cpu?: number;
    memory?: number;
    image: string;
    command?: ReadonlyArray<string>;
    entryPoint?: ReadonlyArray<string>;
    envVars?: ReadonlyArray<EnvVar>;
    secrets?: ReadonlyArray<Secret>;
    policies?: ReadonlyArray<PolicyDocument | string>;
    isOn?: boolean;
    datadogConfig?: AppDatadogConfig;
    cluster?: AppClusterDetails;
}