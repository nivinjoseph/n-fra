import type { EnvVar } from "../common/env-var.js";
import type { Secret } from "../secret/secret.js";
import type { PolicyDocument } from "../security/policy/policy-document.js";
import type { VpcDetails } from "../vpc/vpc-details.js";
import type { SubnetNamePrefix } from "../vpc/vpc-subnet-config.js";
import type { AppClusterDetails } from "./app-cluster-details.js";
import { AppCompute, AppComputeProfile } from "./app-compute-profile.js";
export interface AppConfigBase {
    /** The VPC to deploy into, as returned by `VpcProvisioner.provision()`. */
    vpcDetails: VpcDetails;
    /** Prefix of the VPC subnets the ECS tasks run in (normally a private prefix) (matches `VpcSubnetConfig.prefix`; see `SubnetNamePrefix`). */
    subnetNamePrefix: SubnetNamePrefix;
    /** Fargate task size preset. Default: `AppComputeProfile.small`. Ignored when `customCompute` is set. */
    computeProfile?: AppComputeProfile;
    /**
     * @description https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-cpu-memory-error.html
     */
    customCompute?: AppCompute;
    /**
     * Container image. A bare `<repository>:<tag>` is pulled from this account's ECR (`NfraConfig.ecrBase`) and the tag is
     * verified with ECR DescribeImages during `provision()`, which needs AWS credentials. Images starting with `docker.` or
     * `public.ecr.` are used verbatim and not verified. Tag the image `vX.Y.Z` so `version` can be derived from it.
     */
    image: string;
    /** Version label for tags and Datadog. Default: the text after `:v` in `image`, or `"UNKNOWN"`. */
    version?: string;
    /** Plain environment variables. Put anything sensitive in `secrets` instead; values here land in the task definition. */
    envVars?: ReadonlyArray<EnvVar>;
    /** Secrets from `SecretProvisioner`; each is injected as an environment variable named `Secret.name`. */
    secrets?: ReadonlyArray<Secret>;
    /** IAM permissions for the task role: inline `PolicyDocument`s, or AWS managed policy ARNs starting with `arn:aws:iam::aws:policy/`. */
    policies?: ReadonlyArray<PolicyDocument | string>;
    /** Default: `true`. `false` keeps every resource but sets the desired and maximum task count to 0. */
    isOn?: boolean;
    /** Adds the Datadog agent sidecar and log forwarding. Mutually exclusive with `enableXray`. */
    datadogConfig?: AppDatadogConfig;
    /** Default: `false`. Adds the AWS X-Ray daemon sidecar. Mutually exclusive with `datadogConfig`. */
    enableXray?: boolean;
    /**
     * Minimum running tasks, 0-50. Default: 1. When `minCapacity < maxCapacity` the service autoscales on CPU (target tracking
     * plus a step scale-out); a cluster that uses spot capacity cannot autoscale.
     */
    minCapacity?: number;
    /** Maximum running tasks, 0-50, at least `minCapacity`. Default: 1. */
    maxCapacity?: number;
    /** Default: `false`. The container root filesystem is read-only unless this is set. */
    disableReadonlyRootFilesystem?: boolean;
    /** Default: `"ARM64"` (Graviton). The image must be built for this architecture. */
    cpuArchitecture?: "X86_64" | "ARM64";
    /** Extra AWS tags merged over `NfraConfig.tags`. */
    tags?: Record<string, string>;
}
/**
 * The ECS cluster the app runs on: an existing one from `AppProvisioner.provisionAppCluster` (`cluster`),
 * or a new single-app cluster created from `clusterConfig`. Exactly one must be given.
 */
export type AppClusterChoice = {
    cluster: AppClusterDetails;
    clusterConfig?: never;
} | {
    clusterConfig: AppClusterConfig;
    cluster?: never;
};
/**
 * How the container starts: an explicit `command`, an explicit `entryPoint`, or the image's own
 * CMD/ENTRYPOINT (`useDockerfileCommandOrEntryPoint: true`). Exactly one must be given.
 */
export type AppLaunchChoice = {
    command: ReadonlyArray<string>;
    entryPoint?: never;
    useDockerfileCommandOrEntryPoint?: false;
} | {
    entryPoint: ReadonlyArray<string>;
    command?: never;
    useDockerfileCommandOrEntryPoint?: false;
} | {
    useDockerfileCommandOrEntryPoint: true;
    command?: never;
    entryPoint?: never;
};
export type AppConfig = AppConfigBase & AppClusterChoice & AppLaunchChoice;
/**
 * Non-union view of `AppConfig` for runtime validation with `given()`, which cannot operate on a union type.
 * Every `AppConfig` is assignable to it; the mutual-exclusion rules are re-checked at runtime by the provisioner.
 */
export type AppConfigShape = AppConfigBase & Partial<{
    cluster: AppClusterDetails;
    clusterConfig: AppClusterConfig;
    command: ReadonlyArray<string>;
    entryPoint: ReadonlyArray<string>;
    useDockerfileCommandOrEntryPoint: boolean;
}>;
export interface AppClusterConfig {
    /** Default: `false`. Enables CloudWatch Container Insights on the cluster. */
    enableContainerInsights?: boolean;
    /**
     * Adds the FARGATE_SPOT capacity provider. By default on-demand and spot are mixed (one on-demand task guaranteed,
     * the rest spot); `onlyUseSpotCapacity` removes on-demand entirely. Apps on a spot cluster cannot autoscale
     * (`minCapacity` must equal `maxCapacity`), because spot tasks already come and go with AWS capacity.
     */
    useSpotCapacity?: {
        onlyUseSpotCapacity?: boolean;
    };
}
export interface AppDatadogConfig {
    /** The Datadog site, e.g. `"datadoghq.com"` or `"us5.datadoghq.com"`; used as `DD_SITE` and for the log intake host. */
    ddHost: string;
    /** Datadog API key as a `Secret` from `SecretProvisioner`. */
    apiKey: Secret;
    /** Extra `com.datadoghq.ad.*` docker labels added to the app container. */
    additionalInstrumentationLabels?: {
        [label: string]: string;
    };
    /** Extra volumes mounted into the Datadog agent container. */
    containerMountPoints?: Array<{
        sourceVolume: string;
        containerPath: string;
    }>;
}
//# sourceMappingURL=app-config.d.ts.map