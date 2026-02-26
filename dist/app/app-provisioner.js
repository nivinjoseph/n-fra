import { given } from "@nivinjoseph/n-defensive";
import { ArgumentException, NotImplementedException } from "@nivinjoseph/n-exception";
import * as Pulumi from "@pulumi/pulumi";
// import { ManagedPolicy, Policy, Role } from "@pulumi/aws/iam";
import * as aws from "@pulumi/aws";
import { NfraConfig } from "../common/nfra-config.js";
// import { LogConfiguration } from "@pulumi/aws/ecs";
// import { VirtualNode } from "@pulumi/aws/appmesh";
import { AppComputeProfile } from "./app-compute-profile.js";
import { DescribeImagesCommand, ECRClient } from "@aws-sdk/client-ecr";
import { Logger } from "../index.js";
import * as crypto from "node:crypto";
export class AppProvisioner {
    get name() { return this._name; }
    get vpcDetails() { return this._config.vpcDetails; }
    get config() { return this._config; }
    get version() { return this._version; }
    get hasDatadog() { return this._config.datadogConfig != null; }
    get hasSidecar() { return this._config.sidecarConfig != null; }
    constructor(name, config) {
        var _a, _b;
        var _c;
        given(name, "name").ensureHasValue().ensureIsString();
        // this._name = CommonHelper.prefixName(name);
        this._name = name;
        const defaultConfig = {
            computeProfile: AppComputeProfile.small,
            minCapacity: 1,
            maxCapacity: 1,
            isOn: true
        };
        config = Object.assign(defaultConfig, config);
        given(config, "config").ensureHasValue().ensureIsObject()
            .ensureHasStructure({
            vpcDetails: "object",
            subnetNamePrefix: "string",
            computeProfile: "number",
            "customCompute?": { cpu: "number", memory: "number" },
            image: "string",
            "version?": "string",
            "command?": ["string"],
            "entryPoint?": ["string"],
            "useDockerfileCommandOrEntryPoint?": "boolean",
            "envVars?": ["object"],
            "secrets?": ["object"],
            "policies?": "array",
            isOn: "boolean",
            "datadogConfig?": "object",
            "enableXray?": "boolean",
            "sidecarConfig?": "object",
            "clusterConfig?": "object",
            "cluster?": "object",
            "minCapacity?": "number",
            "maxCapacity?": "number",
            "disableReadonlyRootFilesystem?": "boolean",
            "cpuArchitecture?": "string",
            "tags?": "object"
        })
            // .ensure(t => t.image.contains(":v"), "config.image does not have a valid tag")
            .ensureWhen(config.policies != null && config.policies.isNotEmpty && config.policies.some(t => typeof t === "string"), (t) => t.policies.where(u => typeof u === "string").every(u => u.startsWith("arn:aws:iam::aws:policy/")), "policy string values must be aws managed policies")
            .ensureWhen(config.datadogConfig != null, (t) => !t.enableXray, "only one of datadogConfig or enableXray can be used")
            .ensure(t => !(t.clusterConfig == null && t.cluster == null), "one of clusterConfig or cluster must be provided")
            .ensureWhen(!config.useDockerfileCommandOrEntryPoint, t => !((t.command == null || t.command.isEmpty) && (t.entryPoint == null || t.entryPoint.isEmpty)), "one of either command or entryPoint must be provided")
            .ensureWhen(!config.useDockerfileCommandOrEntryPoint, t => !(t.command != null && t.entryPoint != null), "only one of either command or entryPoint must be provided")
            .ensure(t => t.minCapacity != null && t.minCapacity >= 0 && t.minCapacity <= 50, "minCapacity must be between 0 and 50")
            .ensure(t => t.maxCapacity != null && t.maxCapacity >= 0 && t.maxCapacity <= 50, "maxCapacity must be between 0 and 50")
            .ensure(t => t.minCapacity <= t.maxCapacity, "minCapacity must be <= maxCapacity")
            .ensureWhen(config.cpuArchitecture != null, t => ["X86_64", "ARM64"].contains(t.cpuArchitecture), "cpuArchitecture must be one of X86_64 or ARM64");
        (_a = config.enableXray) !== null && _a !== void 0 ? _a : (config.enableXray = false);
        this._config = config;
        if (this._config.isOn === false)
            this._config.minCapacity = this._config.maxCapacity = 0;
        if (this._config.version != null) {
            this._version = this._config.version;
        }
        else {
            if (this._config.image.contains(":v"))
                this._version = this._config.image.split(":v").takeLast();
            else
                this._version = "UNKNOWN";
        }
        // defaulting cpu architecture to ARM64
        (_b = (_c = this._config).cpuArchitecture) !== null && _b !== void 0 ? _b : (_c.cpuArchitecture = "ARM64");
        this._appEnv = NfraConfig.appEnv;
    }
    static provisionAppCluster(name, config, vpcDetails) {
        given(name, "name").ensureHasValue().ensureIsString();
        // name = CommonHelper.prefixName(name);
        given(config, "config").ensureHasValue().ensureIsObject().ensureHasStructure({
            "enableContainerInsights?": "boolean",
            "useSpotCapacity?": {
                "onlyUseSpotCapacity?": "boolean"
            }
        });
        given(vpcDetails, "vpcDetails").ensureHasValue().ensureIsObject();
        const clusterName = `${name}-cls`;
        const cluster = new aws.ecs.Cluster(clusterName, {
            // capacityProviders: ["FARGATE"], // deprecated
            serviceConnectDefaults: {
                namespace: vpcDetails.privateDnsNamespace.arn
            },
            settings: [
                {
                    name: "containerInsights",
                    value: config.enableContainerInsights ? "enabled" : "disabled"
                }
            ],
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: clusterName })
        });
        let capacityProviders = [CapacityProvider.fargate];
        let capacityProviderStrategies = [{
                capacityProvider: CapacityProvider.fargate,
                base: 1,
                weight: 100
            }];
        if (config.useSpotCapacity != null) {
            capacityProviders.push(CapacityProvider.fargateSpot);
            if (config.useSpotCapacity.onlyUseSpotCapacity) {
                capacityProviders = capacityProviders
                    .where(t => t !== CapacityProvider.fargate);
                capacityProviderStrategies = capacityProviderStrategies
                    .where(t => t.capacityProvider !== CapacityProvider.fargate);
                capacityProviderStrategies.push({
                    capacityProvider: CapacityProvider.fargateSpot,
                    base: 1,
                    weight: 100
                });
            }
            else {
                capacityProviderStrategies = capacityProviderStrategies
                    .where(t => t.capacityProvider !== CapacityProvider.fargate);
                capacityProviderStrategies.push({
                    capacityProvider: CapacityProvider.fargate,
                    base: 1,
                    weight: 1
                }, {
                    capacityProvider: CapacityProvider.fargateSpot,
                    weight: 99
                });
            }
        }
        const clusterCapacityProviderName = `${name}-cls-cp`;
        new aws.ecs.ClusterCapacityProviders(clusterCapacityProviderName, {
            clusterName: cluster.name,
            capacityProviders,
            defaultCapacityProviderStrategies: capacityProviderStrategies
        });
        return {
            clusterName: cluster.name,
            clusterArn: cluster.arn,
            usesSpotInstances: config.useSpotCapacity != null
        };
    }
    async provision() {
        await this._verifyImageExists();
        return this.provisionApp();
    }
    createAppCluster() {
        var _a;
        return (_a = this._config.cluster) !== null && _a !== void 0 ? _a : AppProvisioner.provisionAppCluster(this._name, this._config.clusterConfig, this.vpcDetails);
    }
    createExecutionRole(policies) {
        // given(isEc2, "isEc2").ensureHasValue().ensureIsBoolean();
        given(policies, "policies").ensureIsArray().ensureIsNotEmpty();
        const taskExecutionPolicies = new Array();
        if (policies != null && policies.isNotEmpty)
            taskExecutionPolicies.push(...policies);
        const managedPolicies = taskExecutionPolicies
            .where(t => typeof t === "string");
        const policyDocs = taskExecutionPolicies
            .where(t => typeof t !== "string");
        const secrets = new Array();
        if (this._config.secrets != null && this._config.secrets.isNotEmpty)
            secrets.push(...this._config.secrets);
        if (this._config.datadogConfig != null)
            secrets.push(this._config.datadogConfig.apiKey);
        const policyArns = [
            ...managedPolicies,
            "arn:aws:iam::aws:policy/AmazonECS_FullAccess",
            "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
            // aws.iam.ManagedPolicy.CloudWatchFullAccess
            "arn:aws:iam::aws:policy/CloudWatchFullAccessV2"
        ];
        const resolvedPolicyArns = new Array();
        if (!secrets.isEmpty) {
            const secretPolicyName = `${this._name}-sct-tp`;
            const secretPolicy = new aws.iam.Policy(secretPolicyName, {
                policy: {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Action": "secretsmanager:GetSecretValue",
                            "Resource": secrets.map(t => t.arn)
                        }
                    ]
                },
                tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: secretPolicyName })
            });
            resolvedPolicyArns.push(secretPolicy.arn);
        }
        const createdPolicies = policyDocs.map((policyDoc, index) => {
            const policyName = `${this._name}-tep-${index}`;
            const policy = new aws.iam.Policy(policyName, {
                policy: policyDoc,
                tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: policyName })
            });
            resolvedPolicyArns.push(policy.arn);
            return policy;
        });
        // const factoryFunc = isEc2
        //     // eslint-disable-next-line @typescript-eslint/unbound-method
        //     ? awsx.ecs.EC2TaskDefinition.createExecutionRole
        //     // eslint-disable-next-line @typescript-eslint/unbound-method
        //     : awsx.ecs.FargateTaskDefinition.createExecutionRole;
        if (resolvedPolicyArns.isEmpty)
            return Pulumi.output(_createRole(`${this._name}-ter`, _defaultRoleAssumeRolePolicy(), policyArns, { dependsOn: createdPolicies }));
        else
            return Pulumi.all(resolvedPolicyArns).apply(resolvedArns => {
                return _createRole(`${this._name}-ter`, _defaultRoleAssumeRolePolicy(), [
                    ...policyArns,
                    ...resolvedArns
                ], { dependsOn: createdPolicies });
            });
    }
    createTaskRole(isEc2 = false, policies) {
        given(isEc2, "isEc2").ensureHasValue().ensureIsBoolean();
        given(policies, "policies").ensureIsArray().ensureIsNotEmpty();
        const taskPolicies = new Array();
        if (policies != null && policies.isNotEmpty)
            taskPolicies.push(...policies);
        if (this._config.policies != null && this._config.policies.isNotEmpty)
            taskPolicies.push(...this._config.policies);
        const managedPolicies = taskPolicies
            .where(t => typeof t === "string");
        const policyDocs = taskPolicies
            .where(t => typeof t !== "string");
        const policyArns = [
            ...managedPolicies,
            // aws.iam.ManagedPolicy.CloudWatchFullAccess,
            "arn:aws:iam::aws:policy/CloudWatchFullAccessV2",
            // "arn:aws:iam::aws:policy/AWSAppMeshEnvoyAccess",
            aws.iam.ManagedPolicy.AmazonECSFullAccess,
            ...this._config.enableXray ? [aws.iam.ManagedPolicy.AWSXRayDaemonWriteAccess] : []
        ];
        const resolvedPolicyArns = new Array();
        const createdPolicies = policyDocs.map((policyDoc, index) => {
            const policyName = `${this._name}-tp-${index}`;
            const policy = new aws.iam.Policy(policyName, {
                policy: policyDoc,
                tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: policyName })
            });
            resolvedPolicyArns.push(policy.arn);
            return policy;
        });
        // const factoryFunc = isEc2
        //     // eslint-disable-next-line @typescript-eslint/unbound-method
        //     ? awsx.ecs.EC2TaskDefinition.createTaskRole
        //     // eslint-disable-next-line @typescript-eslint/unbound-method
        //     : awsx.ecs.FargateTaskDefinition.createTaskRole;
        if (resolvedPolicyArns.isEmpty)
            return Pulumi.output(_createRole(`${this._name}-tr`, _defaultRoleAssumeRolePolicy(), policyArns, { dependsOn: createdPolicies }));
        else
            return Pulumi.all(resolvedPolicyArns).apply(resolvedArns => {
                return _createRole(`${this._name}-tr`, _defaultRoleAssumeRolePolicy(), [
                    ...policyArns,
                    ...resolvedArns
                ], { dependsOn: createdPolicies });
            });
    }
    createAppContainer() {
        const imageRegistry = this._config.image.trim().toLowerCase();
        const publicRegistries = ["docker.", "public.ecr."];
        return {
            name: this._name,
            image: publicRegistries.some(t => imageRegistry.startsWith(t))
                ? this._config.image : `${NfraConfig.ecrBase}/${this.config.image}`,
            essential: true,
            readonlyRootFilesystem: this._config.disableReadonlyRootFilesystem ? false : true,
            cpu: 0,
            command: this.config.command ? [...this.config.command] : undefined,
            entryPoint: this.config.entryPoint ? [...this.config.entryPoint] : undefined,
            portMappings: [],
            environment: [
                ...this.config.envVars != null ? this.config.envVars : [],
                ...this._createInstrumentationEnvironmentVariables()
            ].reverse()
                .distinct(t => t.name)
                .orderBy(t => t.name)
                .map(t => {
                // if (typeof t.value === "string")
                //     return { name: t.name, value: Pulumi.output(t.value) };
                // return t;
                return { name: t.name, value: this._interpolatify(t.value) };
            }),
            // .map(t => (<Pulumi.Output<string>>t.value)
            //     .apply(u => ({ name: t.name, value: u }))),
            secrets: this.config.secrets && this.config.secrets.isNotEmpty
                ? this.config.secrets
                    .orderBy(t => t.name)
                    // .map(t => t.arn.apply(u => ({ name: t.name, valueFrom: u })))
                    .map(t => ({ name: t.name, valueFrom: t.arn }))
                : undefined,
            stopTimeout: 45,
            logConfiguration: this._createLogConfiguration(),
            dockerLabels: this.hasDatadog
                ? Object.assign({}, this._createDatadogInstrumentationLabels()) : undefined,
            mountPoints: this.hasSidecar ? [{
                    "sourceVolume": "infra-sidecar",
                    "containerPath": "/infra_sidecar/temp" // FIXME: this needs to be aligned
                }] : [],
            volumesFrom: [],
            dependsOn: [
                // {
                //     containerName: "log_router",
                //     condition: "HEALTHY"
                // },
                // {
                //     containerName: "envoy",
                //     condition: "HEALTHY"
                // },
                ...this.hasSidecar ? [{
                        containerName: "infra-sidecar",
                        condition: "HEALTHY"
                    }] : []
            ]
        };
    }
    createContainerDefinitions(
    // virtualNode: aws.appmesh.VirtualNode,
    appContainerOverrides, isEc2 = false) {
        // given(virtualNode, "virtualNode").ensureHasValue().ensureIsObject();
        given(appContainerOverrides, "appContainerOverrides").ensureIsObject();
        return this._stringifyContainerDefinitions(Object.assign({ [this._name]: appContainerOverrides != null
                ? Object.assign(Object.assign({}, this.createAppContainer()), appContainerOverrides) : this.createAppContainer() }, this._createInstrumentationContainers(
        // virtualNode,
        isEc2)));
    }
    createTaskVolumeConfiguration(isEc2 = false, additionalVolumes) {
        given(isEc2, "isEc2").ensureHasValue().ensureIsBoolean();
        given(additionalVolumes, "additionalVolumes").ensureIsArray().ensureIsNotEmpty();
        const taskVolumeConfiguration = additionalVolumes != null
            ? [...additionalVolumes] : [];
        if (this.hasDatadog) {
            taskVolumeConfiguration.push({ "name": "etc-datadog_agent" });
            if (isEc2) {
                taskVolumeConfiguration.push({
                    name: "docker_sock",
                    hostPath: "/var/run/docker.sock"
                }, {
                    name: "cgroup",
                    hostPath: "/sys/fs/cgroup/"
                }, {
                    name: "proc",
                    hostPath: "/proc/"
                });
            }
        }
        if (this.hasSidecar)
            taskVolumeConfiguration.push({
                name: "infra-sidecar",
                dockerVolumeConfiguration: {
                    scope: "task",
                    driver: "local"
                }
            });
        return taskVolumeConfiguration;
    }
    supportsAutoScaling() {
        return this._config.minCapacity < this._config.maxCapacity;
    }
    configureAutoScaling(cluster, service) {
        if (!this.supportsAutoScaling())
            return;
        given(cluster, "cluster").ensureHasValue().ensureIsObject()
            .ensure(t => !t.usesSpotInstances, "custer uses spot instances, cannot enable autoscaling");
        const asTarget = new aws.appautoscaling.Target(`${this._name}-ast`, {
            minCapacity: this.config.minCapacity,
            maxCapacity: this.config.maxCapacity,
            resourceId: Pulumi.interpolate `service/${cluster.clusterName}/${service.name}`,
            scalableDimension: "ecs:service:DesiredCount",
            serviceNamespace: "ecs"
        });
        new aws.appautoscaling.Policy(`${this._name}-asp`, {
            policyType: "TargetTrackingScaling",
            resourceId: asTarget.resourceId,
            scalableDimension: asTarget.scalableDimension,
            serviceNamespace: asTarget.serviceNamespace,
            targetTrackingScalingPolicyConfiguration: {
                targetValue: 60,
                scaleInCooldown: 300,
                scaleOutCooldown: 60,
                predefinedMetricSpecification: {
                    predefinedMetricType: "ECSServiceAverageCPUUtilization"
                }
            }
        });
    }
    async _verifyImageExists() {
        if (this._config.image.trim().toLowerCase().startsWith("docker."))
            return;
        // else
        //     return;
        const [imageRepo, imageTag] = this._config.image.split(":");
        const ecrClient = new ECRClient({
            region: NfraConfig.ecrAwsRegion
        });
        const command = new DescribeImagesCommand({
            registryId: NfraConfig.ecrAwsAccountId,
            repositoryName: imageRepo,
            imageIds: [{ imageTag: imageTag }]
        });
        try {
            const response = await ecrClient.send(command);
            if (response.imageDetails == null || response.imageDetails.isEmpty)
                throw new Error("Image not found");
        }
        catch (error) {
            const message = `image '${this._config.image}' for service '${this._name}' not found in ECR`;
            console.warn(message);
            console.error(error);
            try {
                await Logger.logWarning(message);
                await Logger.logError(error);
            }
            // eslint-disable-next-line no-empty
            catch (_a) { }
            throw new ArgumentException("image", message);
        }
    }
    _stringifyContainerDefinitions(containerDefinitions) {
        return Object.entries(containerDefinitions)
            .map(entry => {
            return Object.assign(Object.assign({}, entry[1]), { name: entry[0] });
        })
            .map(container => {
            return Object.entries(container)
                .map(entry => {
                const key = JSON.stringify(entry[0]);
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if (entry[1] === undefined)
                    return null;
                /**
                 * Lets make some assumptions
                 * Right side is either
                 * 1. primitive => Just use
                 * 2. Applicable => Just use
                 * 3. Array => iterate and check value type and take action
                 * 4. Object => browse entries and take action
                 *
                 *
                 */
                // const rightSide = entry[1];
                // const isOutput = (input: any): boolean =>
                // {
                //     return input != null
                //     // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                //         && (<Pulumi.Output<any>>input).apply != null
                //         && typeof (<Pulumi.Output<any>>input).apply === "function";
                // };
                // // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                // const value = entry[1] != null && (<Pulumi.Output<any>>entry[1]).apply != null && typeof (<Pulumi.Output<any>>entry[1]).apply === "function"
                //     ? (<Pulumi.Output<any>>entry[1]).apply((val: any) => JSON.stringify(val))
                //     : JSON.stringify(entry[1]);
                // return Pulumi.interpolate`${key}:${value}`;
                return Pulumi.interpolate `${key}:${this._interpolatify(entry[1])}`;
            })
                .where(t => t != null)
                .reduce((acc, value, index, all) => {
                acc = Pulumi.interpolate `${acc}${index === 0 ? "" : ","}${value}${index === (all.length - 1) ? "}" : ""}`;
                // FIXME: adding the trailing '}' here only works because we are guaranteed to not have an empty object
                return acc;
            }, Pulumi.interpolate `{`);
        })
            .reduce((acc, value, index, all) => {
            acc = Pulumi.interpolate `${acc}${index === 0 ? "" : ","}${value}${index === (all.length - 1) ? "]" : ""}`;
            // FIXME: adding the trailing ']' here only works because we are guaranteed to not have an empty array
            return acc;
        }, Pulumi.interpolate `[`);
    }
    _interpolatify(value) {
        if (typeof value === "string") {
            if (value.trim().startsWith(`"`) && value.trim().endsWith(`"`))
                return value;
            return `"${value}"`;
        }
        if (typeof value === "number" || typeof value === "boolean")
            return `${value}`;
        const isApplicable = (input) => {
            return input != null
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                && input.apply != null
                && typeof input.apply === "function";
        };
        if (isApplicable(value))
            return value.apply(t => this._interpolatify(t));
        if (Array.isArray(value)) {
            const interpolated = new Array();
            for (const item of value)
                interpolated.push(this._interpolatify(item));
            const interpolatedString = interpolated.reduce((acc, val, index) => {
                acc = Pulumi.interpolate `${acc}${index === 0 ? "" : ","}${val}`;
                return acc;
            }, Pulumi.interpolate `[`);
            return Pulumi.interpolate `${interpolatedString}]`;
        }
        // object
        const interpolated = new Array();
        for (const entry of Object.entries(value))
            interpolated.push(Pulumi.interpolate `"${entry[0]}":${this._interpolatify(entry[1])}`);
        const interpolatedString = interpolated.reduce((acc, val, index) => {
            acc = Pulumi.interpolate `${acc}${index === 0 ? "" : ","}${val}`;
            return acc;
        }, Pulumi.interpolate `{`);
        return Pulumi.interpolate `${interpolatedString}}`;
    }
    _createLogConfiguration() {
        if (this.hasDatadog) {
            return {
                logDriver: "awsfirelens",
                options: {
                    "Name": "datadog",
                    "Host": `http-intake.logs.${this._config.datadogConfig.ddHost}`,
                    "TLS": "on",
                    "compress": "gzip",
                    // "dd_env": this._appEnv, // this causes error killing log_router container
                    "dd_service": this._name,
                    "dd_source": "stdout",
                    "dd_tags": Object.entries(NfraConfig.tags)
                        .reduce((acc, entry) => acc + `${acc.length > 0 ? "," : ""}${entry[0]}:${entry[1]}`, "")
                        .trim(),
                    "provider": "ecs"
                },
                secretOptions: [{
                        name: "apikey",
                        valueFrom: this._config.datadogConfig.apiKey.arn
                    }]
            };
        }
        else {
            // return Pulumi.output({
            //     logDriver: "awsfirelens",
            //     options: {
            //         "Name": "cloudwatch",
            //         "region": NfraConfig.awsRegion,
            //         "log_key": "message",
            //         // "log_group_name": this._name,
            //         // "log_group_name": "/aws/ecs/containerinsights/$(ecs_cluster)/application",
            //         "log_group_name": `/aws/ecs/${this._name}/application`,
            //         "auto_create_group": "true",
            //         // "log_stream_name": this._name,
            //         "log_stream_name": "$(ecs_task_id)",
            //         "retry_limit": "2"
            //     }
            // });
            return {
                logDriver: "awslogs",
                options: {
                    "awslogs-group": `/aws/ecs/${this._name}/application`,
                    "awslogs-create-group": "true",
                    "awslogs-region": NfraConfig.awsRegion,
                    "awslogs-stream-prefix": "ecs"
                }
            };
        }
    }
    _createAwsLogsConfiguration(containerName) {
        given(containerName, "containerName").ensureHasValue().ensureIsString();
        return {
            logDriver: "awslogs",
            options: {
                "awslogs-group": `/aws/ecs/${this._name}/${containerName}`,
                "awslogs-create-group": "true",
                "awslogs-region": NfraConfig.awsRegion,
                "awslogs-stream-prefix": "ecs"
            }
        };
    }
    _createInstrumentationEnvironmentVariables() {
        const result = [
            { name: "env", value: this._appEnv }
        ];
        if (this.hasDatadog)
            result.push({ name: "DD_ENV", value: this._appEnv }, { name: "DD_SERVICE", value: this._name }, { name: "DD_VERSION", value: this._version });
        else if (this._config.enableXray)
            result.push({ name: "enableXrayTracing", value: "true" });
        return result;
    }
    _createDatadogInstrumentationLabels() {
        var _a;
        const labels = Object.assign({ "com.datadoghq.tags.env": this._appEnv, "com.datadoghq.tags.service": this._name, "com.datadoghq.tags.version": this._version }, (_a = this._config.datadogConfig.additionalInstrumentationLabels) !== null && _a !== void 0 ? _a : {});
        return labels;
    }
    _createInstrumentationContainers(
    // vnode: aws.appmesh.VirtualNode,
    isEc2 = false) {
        const containers = {
        // "log_router": this._createLogRouterContainer(),
        // "envoy": this._createEnvoyContainer(vnode)
        };
        if (this.hasDatadog) {
            containers["log_router"] = this._createLogRouterContainer();
            containers["datadog-agent"] = this._createDatadogAgentContainer(isEc2);
        }
        else if (this._config.enableXray)
            containers["xray"] = this._createAwsOtelCollectorContainer(); // this._createAwsXrayDaemonContainer();
        if (this.hasSidecar)
            containers["infra-sidecar"] = this._createInfraSidecarContainer();
        return containers;
    }
    _createLogRouterContainer() {
        return {
            name: "log_router",
            // public.ecr.aws/aws-observability/aws-for-fluent-bit:2.34.1.20251112
            image: "public.ecr.aws/aws-observability/aws-for-fluent-bit:2.34.1.20251112",
            essential: true,
            readonlyRootFilesystem: true,
            cpu: 10,
            memoryReservation: 50,
            firelensConfiguration: {
                type: "fluentbit",
                options: {
                    "enable-ecs-log-metadata": "false",
                    "config-file-type": "file",
                    "config-file-value": "/fluent-bit/configs/parse-json.conf"
                }
            },
            logConfiguration: this._createAwsLogsConfiguration("log_router"),
            environment: [],
            mountPoints: [],
            portMappings: [],
            user: "0",
            volumesFrom: [],
            healthCheck: {
                "command": [
                    "CMD", "nc", "-z", "localhost", "8877"
                ],
                "retries": 3,
                "timeout": 10,
                "interval": 30,
                "startPeriod": 15
            }
        };
    }
    // private _createEnvoyContainer(vnode: aws.appmesh.VirtualNode): awsx.ecs.Container
    // {
    //     given(vnode, "vnode").ensureHasValue().ensureIsObject();
    //     return {
    //         image: "public.ecr.aws/appmesh/aws-appmesh-envoy:v1.24.0.0-prod",
    //         essential: true,
    //         readonlyRootFilesystem: false,
    //         cpu: 300,
    //         memoryReservation: 256,
    //         environment: vnode.arn.apply(vnodeArn =>
    //         {
    //             return [
    //                 { name: "APPMESH_RESOURCE_ARN", value: vnodeArn },
    //                 ...this.hasDatadog
    //                     ? [
    //                         { name: "ENABLE_ENVOY_DATADOG_TRACING", value: "1" },
    //                         { name: "DD_ENV", value: this._appEnv },
    //                         { name: "DD_SERVICE", value: this._name }
    //                         // { name: "DATADOG_TRACER_PORT", value: "8126" },
    //                         // { name: "DATADOG_TRACER_ADDRESS", value: "127.0.0.1" }, // <- service discovery for the datadog agent
    //                     ]
    //                     : this._config.enableXray
    //                         ? [{ name: "ENABLE_ENVOY_XRAY_TRACING", value: "1" }]
    //                         : [],
    //                 { name: "ENABLE_ENVOY_STATS_TAGS", value: "1" },
    //                 { name: "ENABLE_ENVOY_DOG_STATSD", value: "1" },
    //                 // { name: "ENVOY_LOG_LEVEL", value: "debug" }
    //                 { name: "ENVOY_LOG_LEVEL", value: "off" },
    //                 { name: "LISTENER_DRAIN_WAIT_TIME_S", value: "50" }
    //             ].orderBy(t => t.name);
    //         }),
    //         dockerLabels: this.hasDatadog
    //             ? {
    //                 "com.datadoghq.ad.logs": `[{"source": "envoy", "service": "${this._name}-envoy"}]`,
    //                 "com.datadoghq.tags.env": this._appEnv,
    //                 "com.datadoghq.tags.service": `${this._name}-envoy`,
    //                 "com.datadoghq.ad.instances": `[{ "stats_url": "http://%%host%%:9901/stats" }]`,
    //                 "com.datadoghq.ad.check_names": `["envoy"]`,
    //                 "com.datadoghq.ad.init_configs": `[{}]`
    //             }
    //             : undefined,
    //         // logConfiguration: this._createLogConfiguration(`${service}-envoy`),
    //         logConfiguration: this._createAwsLogsConfiguration("envoy"),
    //         dependsOn: this.hasDatadog
    //             ? [{
    //                 containerName: "datadog-agent",
    //                 // condition: "START"
    //                 condition: "HEALTHY"
    //             }]
    //             : this._config.enableXray
    //                 ? [{
    //                     containerName: "xray",
    //                     // condition: "START"
    //                     condition: "HEALTHY"
    //                 }]
    //                 : undefined,
    //         mountPoints: [],
    //         // mountPoints: [
    //         //     {
    //         //         readOnly: false,
    //         //         containerPath: "/tmp",
    //         //         sourceVolume: "tmp-envoy"
    //         //     },
    //         //     {
    //         //         readOnly: false,
    //         //         containerPath: "/etc",
    //         //         sourceVolume: "etc-envoy"
    //         //     }
    //         // ],
    //         portMappings: [
    //             {
    //                 hostPort: 9901,
    //                 containerPort: 9901,
    //                 protocol: "tcp"
    //             },
    //             {
    //                 hostPort: 15000,
    //                 containerPort: 15000,
    //                 protocol: "tcp"
    //             },
    //             {
    //                 hostPort: 15001,
    //                 containerPort: 15001,
    //                 protocol: "tcp"
    //             }
    //         ],
    //         stopTimeout: 60,
    //         user: "1337",
    //         ulimits: [{
    //             name: "nofile",
    //             hardLimit: 15000,
    //             softLimit: 15000
    //         }],
    //         volumesFrom: [],
    //         healthCheck: {
    //             "command": [
    //                 "CMD-SHELL", "curl -s http://localhost:9901/server_info | grep state | grep -q LIVE"
    //             ],
    //             "retries": 3,
    //             "timeout": 10,
    //             "interval": 30,
    //             "startPeriod": 15
    //         }
    //     };
    // }
    _createDatadogAgentContainer(isEc2 = false) {
        var _a, _b, _c;
        given(isEc2, "isEc2").ensureHasValue().ensureIsBoolean();
        given(this, "this").ensure(t => t.hasDatadog, "datadog config must be provided");
        const environment = [
            { name: "DD_SITE", value: this._config.datadogConfig.ddHost },
            { name: "DD_APM_NON_LOCAL_TRAFFIC", value: "true" },
            // { name: "ECS_FARGATE", value: "true" },
            { name: "DD_APM_ENABLED", value: "true" },
            { name: "DD_LOGS_ENABLED", value: "true" },
            { name: "DD_DOGSTATSD_NON_LOCAL_TRAFFIC", value: "true" },
            // { name: "DD_API_KEY", value: this._config.datadogConfig!.apiKey },
            // { name: "DD_OTLP_CONFIG_RECEIVER_PROTOCOLS_GRPC_ENDPOINT", value: "0.0.0.0:4317"}
            { name: "DD_OTLP_CONFIG_RECEIVER_PROTOCOLS_HTTP_ENDPOINT", value: "0.0.0.0:4318" },
            { name: "DD_ECS_TASK_COLLECTION_ENABLED", value: "true" }
        ];
        const mountPoints = [
            {
                sourceVolume: "etc-datadog_agent",
                containerPath: "/etc/datadog-agent",
                readOnly: false
            },
            ...(_c = (_b = (_a = this.config.datadogConfig) === null || _a === void 0 ? void 0 : _a.containerMountPoints) === null || _b === void 0 ? void 0 : _b.map(t => {
                t.readOnly = true;
                return t;
            })) !== null && _c !== void 0 ? _c : []
        ];
        if (isEc2) {
            environment.push({ name: "DD_ECS_COLLECT_RESOURCE_TAGS_EC2", value: "true" });
            mountPoints.push({
                sourceVolume: "docker_sock",
                containerPath: "/var/run/docker.sock",
                readOnly: false
            }, {
                sourceVolume: "cgroup",
                containerPath: "/host/sys/fs/cgroup",
                readOnly: false
            }, {
                sourceVolume: "proc",
                containerPath: "/host/proc",
                readOnly: false
            });
        }
        else {
            environment.push({ name: "ECS_FARGATE", value: "true" });
        }
        return {
            name: "datadog-agent",
            image: "public.ecr.aws/datadog/agent:7.73.0-rc.6-jmx",
            essential: true,
            readonlyRootFilesystem: true,
            cpu: 30,
            memoryReservation: 256, // soft limit
            portMappings: [
                {
                    hostPort: 8126,
                    containerPort: 8126,
                    protocol: "tcp"
                },
                {
                    hostPort: 8125,
                    containerPort: 8125,
                    protocol: "udp"
                },
                {
                    hostPort: 4318,
                    containerPort: 4318,
                    protocol: "tcp"
                }
            ],
            environment: environment.orderBy(t => t.name),
            secrets: [{ name: "DD_API_KEY", valueFrom: this._config.datadogConfig.apiKey.arn }],
            // .orderBy(t => t.name)
            // .map(t => t.arn.apply(u => ({ name: t.name, valueFrom: u }))),
            dockerLabels: {
                "com.datadoghq.ad.logs": JSON.stringify(`[{"source": "datadog-agent", "service": "datadog-agent"}]`)
            },
            logConfiguration: this._createAwsLogsConfiguration("datadog-agent"),
            mountPoints,
            volumesFrom: [],
            healthCheck: {
                "command": [
                    "CMD-SHELL",
                    "agent health"
                ],
                "retries": 3,
                "timeout": 10,
                "interval": 30,
                "startPeriod": 15
            }
        };
    }
    // // @ts-expect-error: not used atm
    // private _createAwsXrayDaemonContainer(): Container
    // {
    //     given(this, "this").ensure(t => !t.hasDatadog, "cannot use Xray when datadog config is provided");
    //     return {
    //         image: "public.ecr.aws/xray/aws-xray-daemon:3.3.5",
    //         essential: true,
    //         readonlyRootFilesystem: false,
    //         cpu: 30,
    //         memoryReservation: 256,
    //         portMappings: [{
    //             hostPort: 2000,
    //             containerPort: 2000,
    //             protocol: "udp"
    //         }],
    //         environment: [],
    //         logConfiguration: this._createAwsLogsConfiguration("xray"),
    //         mountPoints: [],
    //         volumesFrom: [],
    //         healthCheck: {
    //             "command": [
    //                 "CMD-SHELL",
    //                 "timeout 1 /bin/bash -c \"</dev/udp/localhost/2000\""
    //             ],
    //             "retries": 3,
    //             "timeout": 10,
    //             "interval": 30,
    //             "startPeriod": 15
    //         }
    //     };
    // }
    _createAwsOtelCollectorContainer() {
        given(this, "this").ensure(t => t._config.enableXray, "xray must be enabled");
        return {
            name: "xray",
            image: "public.ecr.aws/aws-observability/aws-otel-collector:v0.25.0",
            essential: true,
            readonlyRootFilesystem: false,
            cpu: 30,
            memoryReservation: 256,
            command: ["--config=/etc/ecs/ecs-default-config.yaml"],
            portMappings: [
                {
                    hostPort: 2000,
                    containerPort: 2000,
                    protocol: "udp"
                },
                {
                    hostPort: 8125,
                    containerPort: 8125,
                    protocol: "udp"
                },
                {
                    hostPort: 4318,
                    containerPort: 4318,
                    protocol: "tcp"
                }
            ],
            environment: [],
            logConfiguration: this._createAwsLogsConfiguration("xray"),
            mountPoints: [],
            volumesFrom: [],
            healthCheck: {
                "command": ["/healthcheck"],
                "retries": 3,
                "timeout": 10,
                "interval": 30,
                "startPeriod": 15
            }
        };
    }
    _createInfraSidecarContainer() {
        given(this, "this")
            .ensure(t => t.hasSidecar, "sidecar config must be provided");
        // FIXME: implement this
        // container name must be
        throw new NotImplementedException();
    }
}
var CapacityProvider;
(function (CapacityProvider) {
    CapacityProvider["fargate"] = "FARGATE";
    CapacityProvider["fargateSpot"] = "FARGATE_SPOT";
})(CapacityProvider || (CapacityProvider = {}));
/** @internal */
function _defaultRoleAssumeRolePolicy() {
    return {
        "Version": "2012-10-17",
        "Statement": [{
                "Action": "sts:AssumeRole",
                "Principal": {
                    "Service": "ecs-tasks.amazonaws.com",
                },
                "Effect": "Allow",
                "Sid": "",
            }],
    };
}
/** @internal */
function _createRole(name, assumeRolePolicy, policyArns, opts) {
    return _createRoleAndPolicies(name, assumeRolePolicy, policyArns, opts);
}
/** @internal */
function _createRoleAndPolicies(name, assumeRolePolicy, policyArns, opts) {
    if (typeof assumeRolePolicy !== "string") {
        assumeRolePolicy = JSON.stringify(assumeRolePolicy);
    }
    const role = new aws.iam.Role(name, { assumeRolePolicy, forceDetachPolicies: true }, opts);
    const policies = [];
    for (let i = 0; i < policyArns.length; i++) {
        const policyArn = policyArns[i];
        policies.push(new aws.iam.RolePolicyAttachment(`${name}-${_sha1hash(policyArn)}`, { role, policyArn }, opts));
    }
    return role;
}
// sha1hash returns a partial SHA1 hash of the input string.
/** @internal */
function _sha1hash(s) {
    const shasum = crypto.createHash("sha1");
    shasum.update(s);
    // TODO[pulumi/pulumi#377] Workaround for issue with long names not generating per-deplioyment randomness, leading
    //     to collisions.  For now, limit the size of hashes to ensure we generate shorter/ resource names.
    return shasum.digest("hex").substring(0, 8);
}
//# sourceMappingURL=app-provisioner.js.map