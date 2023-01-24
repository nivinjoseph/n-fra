import { AppDatadogConfig } from "./app-datadog-config";
import { EnvVar } from "../common/env-var";
import { Secret } from "../secrets/secret";
import { PolicyDocument } from "../security/policy/policy-document";
import { VpcDetails } from "../vpc/vpc-details";
import { AppClusterDetails } from "./app-cluster-details";


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