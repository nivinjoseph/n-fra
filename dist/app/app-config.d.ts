import { AppDatadogConfig } from "./app-datadog-config";
import { EcsEnvVar } from "../common/ecs-env-var";
import { AppSecret } from "../secrets/app-secret";
import { PolicyDocument } from "../security/policy/policy-document";
import { VpcDetails } from "../vpc/vpc-details";
export interface AppConfig {
    vpcDetails: VpcDetails;
    subnetNamePrefix: string;
    cpu?: number;
    memory?: number;
    image: string;
    command?: ReadonlyArray<string>;
    entryPoint?: ReadonlyArray<string>;
    envVars?: ReadonlyArray<EcsEnvVar>;
    secrets?: ReadonlyArray<AppSecret>;
    policies?: ReadonlyArray<PolicyDocument>;
    isOn?: boolean;
    datadogConfig?: AppDatadogConfig;
}
