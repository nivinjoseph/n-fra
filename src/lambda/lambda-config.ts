import { EnvVar } from "../common/env-var.js";
import { VpcDetails } from "../vpc/vpc-details.js";


export interface LambdaConfig
{
    codeFilePath: string;
    memorySize: number;
    envVars?: ReadonlyArray<EnvVar>;
    handler: string;
    timeout: number;
    provisionedConcurrency?: number;
    vpcDetails?: VpcDetails;
    subnetNamePrefix?: string;
    ingressSubnetNamePrefixes?: ReadonlyArray<string>;
}