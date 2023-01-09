import { PolicyDocument } from "@pulumi/aws/iam";
import { AppDatadogConfig } from "./app-datadog-config";
import { EcsEnvVar } from "./ecs-env-var";
import { AppSecret } from "../secrets/app-secret";


export interface AppConfig
{
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