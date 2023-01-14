import { EcsEnvVar } from "../common/ecs-env-var";
import { VpcDetails } from "../vpc/vpc-details";


export interface LambdaConfig
{
    codeZipFilePath: string;
    memorySize: number;
    envVars?: ReadonlyArray<EcsEnvVar>;
    handler: string;
    timeout: number;
    provisionedConcurrency?: number;
    vpcDetails?: VpcDetails;
    subnetNamePrefix?: string;
    ingressSubnetNamePrefixes?: ReadonlyArray<string>;
}