import * as Pulumi from "@pulumi/pulumi";
import type { VpcDetails } from "../vpc/vpc-details.js";
import type { AppClusterConfig, AppConfig } from "./app-config.js";
import * as aws from "@pulumi/aws";
import type { PolicyDocument } from "../security/policy/policy-document.js";
import type { AppClusterDetails } from "./app-cluster-details.js";
import type { AppDetails } from "./app-details.js";
export declare abstract class AppProvisioner<T extends AppConfig, U extends AppDetails> {
    /**
     * @description Liveness-grade ECS health check timing for app containers. A task is only marked UNHEALTHY after
     * `retries` consecutive failures, so a busy-but-responding task is never killed while a wedged one is still
     * replaced (worst case ~ retries x timeout + (retries - 1) x interval ~ 8.7 min).
     * ECS bounds: interval 5-300, timeout 2-60, retries 1-10, startPeriod 0-300.
     */
    private static readonly _healthCheckIntervalSeconds;
    private static readonly _healthCheckTimeoutSeconds;
    private static readonly _healthCheckRetries;
    private static readonly _healthCheckStartPeriodSeconds;
    private static readonly _cpuTargetPercent;
    private static readonly _scaleOutCooldownSeconds;
    private static readonly _scaleInCooldownSeconds;
    private static readonly _stepScaleOutCpuThresholdPercent;
    private static readonly _stepScaleOutSecondTierOffsetPercent;
    private static readonly _stepScaleOutCooldownSeconds;
    private static readonly _stepScaleOutAlarmPeriodSeconds;
    private static readonly _publicImageRegistries;
    private readonly _name;
    private readonly _config;
    private readonly _version;
    private readonly _appEnv;
    protected get name(): string;
    protected get vpcDetails(): VpcDetails;
    protected get config(): T;
    protected get version(): string;
    protected get hasDatadog(): boolean;
    protected constructor(name: string, config: T);
    static provisionAppCluster(name: string, config: AppClusterConfig, vpcDetails: VpcDetails): AppClusterDetails;
    provision(): Promise<U>;
    protected abstract provisionApp(): U;
    protected createAppCluster(): AppClusterDetails;
    protected createExecutionRole(policies?: ReadonlyArray<PolicyDocument | string>): Pulumi.Output<aws.iam.Role>;
    protected createTaskRole(isEc2?: boolean, policies?: ReadonlyArray<PolicyDocument | string>): Pulumi.Output<aws.iam.Role>;
    protected createAppContainer(): aws.ecs.ContainerDefinition;
    protected createContainerDefinitions(appContainerOverrides?: Partial<aws.ecs.ContainerDefinition>, isEc2?: boolean): Pulumi.Output<string>;
    protected createTaskVolumeConfiguration(isEc2?: boolean, additionalVolumes?: ReadonlyArray<aws.types.input.ecs.TaskDefinitionVolume>): Array<aws.types.input.ecs.TaskDefinitionVolume>;
    /**
     * @description Builds the app container's ECS health check. `probeBudgetSeconds` is the longest the probe command
     * itself may run before giving up; it must finish before ECS's own timeout so the probe result, not an ECS kill,
     * decides the outcome.
     */
    protected createAppHealthCheck(shellCommand: string, probeBudgetSeconds: number): aws.ecs.HealthCheck;
    protected supportsAutoScaling(): boolean;
    protected configureAutoScaling(cluster: AppClusterDetails, service: aws.ecs.Service): void;
    private _isPublicImage;
    private _verifyImageExists;
    private _stringifyContainerDefinitions;
    private _interpolatify;
    private _createLogConfiguration;
    private _createAwsLogsConfiguration;
    private _createInstrumentationEnvironmentVariables;
    private _createDatadogInstrumentationLabels;
    private _createInstrumentationContainers;
    private _createLogRouterContainer;
    private _createDatadogAgentContainer;
    private _createAwsOtelCollectorContainer;
}
//# sourceMappingURL=app-provisioner.d.ts.map