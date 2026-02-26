import type { EnvVar } from "../common/env-var.js";
import type { Secret } from "../secret/secret.js";
import type { PolicyDocument } from "../security/policy/policy-document.js";
import type { VpcDetails } from "../vpc/vpc-details.js";
import type { AppClusterDetails } from "./app-cluster-details.js";
import { AppCompute, AppComputeProfile } from "./app-compute-profile.js";
export interface AppConfig {
    vpcDetails: VpcDetails;
    subnetNamePrefix: string;
    computeProfile?: AppComputeProfile;
    /**
     * @description https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-cpu-memory-error.html
     */
    customCompute?: AppCompute;
    image: string;
    version?: string;
    command?: ReadonlyArray<string>;
    entryPoint?: ReadonlyArray<string>;
    useDockerfileCommandOrEntryPoint?: boolean;
    envVars?: ReadonlyArray<EnvVar>;
    secrets?: ReadonlyArray<Secret>;
    policies?: ReadonlyArray<PolicyDocument | string>;
    isOn?: boolean;
    datadogConfig?: AppDatadogConfig;
    enableXray?: boolean;
    sidecarConfig?: AppSidecarConfig;
    clusterConfig?: AppClusterConfig;
    cluster?: AppClusterDetails;
    minCapacity?: number;
    maxCapacity?: number;
    disableReadonlyRootFilesystem?: boolean;
    cpuArchitecture?: "X86_64" | "ARM64";
    tags?: Record<string, string>;
}
export interface AppClusterConfig {
    enableContainerInsights?: boolean;
    /**
     * @description Services within this cluster cannot use autoScaling if Spot Capacity is enabled
     *
     * lets understand the philosophy here

     * autoscaling min 1 and max N => the idea is there is always 1 running and the system will react to load
     * and provision more instances immediately but in increments of 1 up to a max of N
     * Goal of autoscaling is to be able to scale up fast in order to meet demand.

     * spotInstances N => 1 guaranteed and N-1 not guaranteed, the N-1 instances are active based on capacity availability
     * within AWS and if capacity exists then all N instances will be active.
     */
    useSpotCapacity?: {
        onlyUseSpotCapacity?: boolean;
    };
}
export interface AppDatadogConfig {
    ddHost: string;
    apiKey: Secret;
    additionalInstrumentationLabels?: {
        [label: string]: string;
    };
    containerMountPoints?: Array<{
        sourceVolume: string;
        containerPath: string;
    }>;
}
export interface AppSidecarConfig {
}
//# sourceMappingURL=app-config.d.ts.map