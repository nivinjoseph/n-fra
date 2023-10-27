"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppProvisioner = void 0;
const n_defensive_1 = require("@nivinjoseph/n-defensive");
const n_exception_1 = require("@nivinjoseph/n-exception");
const Pulumi = require("@pulumi/pulumi");
// import { ManagedPolicy, Policy, Role } from "@pulumi/aws/iam";
const aws = require("@pulumi/aws");
// import { Container, FargateTaskDefinition } from "@pulumi/awsx/ecs";
const awsx = require("@pulumi/awsx");
const nfra_config_1 = require("../nfra-config");
// import { LogConfiguration } from "@pulumi/aws/ecs";
// import { VirtualNode } from "@pulumi/aws/appmesh";
class AppProvisioner {
    get name() { return this._name; }
    get vpcDetails() { return this._config.vpcDetails; }
    get config() { return this._config; }
    get version() { return this._version; }
    get hasDatadog() { return this._config.datadogConfig != null; }
    constructor(name, config) {
        (0, n_defensive_1.given)(name, "serviceName").ensureHasValue().ensureIsString();
        this._name = name;
        const defaultConfig = {
            cpu: 512,
            memory: 1024,
            isOn: true
        };
        config = Object.assign(defaultConfig, config);
        (0, n_defensive_1.given)(config, "config").ensureHasValue().ensureIsObject()
            .ensureHasStructure({
            vpcDetails: "object",
            subnetNamePrefix: "string",
            cpu: "number",
            memory: "number",
            image: "string",
            "command?": ["string"],
            "entryPoint?": ["string"],
            "envVars?": ["object"],
            "secrets?": ["object"],
            "policies?": "array",
            isOn: "boolean",
            "datadogConfig?": "object",
            "cluster?": "object"
        })
            .ensure(t => t.image.contains(":v"), "config.image does not have a valid tag")
            .ensureWhen(config.policies != null && config.policies.isNotEmpty && config.policies.some(t => typeof t === "string"), (t) => t.policies.where(u => typeof u === "string").every(u => u.startsWith("arn:aws:iam::aws:policy/")), "policy string values must be aws managed policies");
        if ((config.command == null || config.command.isEmpty) && (config.entryPoint == null || config.entryPoint.isEmpty))
            throw new n_exception_1.ArgumentException("config", "one of either command or entryPoint must be provided");
        if (config.command != null && config.entryPoint != null)
            throw new n_exception_1.ArgumentException("config", "only one of either command or entryPoint must be provided");
        this._config = config;
        this._version = config.image.split(":").takeLast().substring(1);
    }
    static provisionAppCluster(name) {
        const clusterName = `${name}-cluster`;
        const cluster = new aws.ecs.Cluster(clusterName, {
            capacityProviders: ["FARGATE"],
            settings: [
                {
                    name: "containerInsights",
                    value: "enabled"
                }
            ],
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: clusterName })
        });
        return {
            clusterName: cluster.name,
            clusterArn: cluster.arn
        };
    }
    createAppCluster() {
        var _a;
        return (_a = this._config.cluster) !== null && _a !== void 0 ? _a : AppProvisioner.provisionAppCluster(this._name);
    }
    createExecutionRole() {
        const secrets = new Array();
        if (this._config.secrets != null && this._config.secrets.isNotEmpty)
            secrets.push(...this._config.secrets);
        if (this._config.datadogConfig != null)
            secrets.push(this._config.datadogConfig.apiKey);
        if (secrets.isEmpty)
            return Pulumi.output(awsx.ecs.FargateTaskDefinition.createExecutionRole(`${this.name}-ter`, undefined, [
                "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
                // aws.iam.ManagedPolicy.CloudWatchFullAccess
                "arn:aws:iam::aws:policy/CloudWatchFullAccessV2"
            ]));
        const secretPolicyName = `${this.name}-secrets-tp`;
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
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: secretPolicyName })
        });
        return secretPolicy.arn.apply(secretPolicyArn => awsx.ecs.FargateTaskDefinition.createExecutionRole(`${this.name}-ter`, undefined, [
            "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
            // aws.iam.ManagedPolicy.CloudWatchFullAccess,
            "arn:aws:iam::aws:policy/CloudWatchFullAccessV2",
            secretPolicyArn
        ], { dependsOn: secretPolicy }));
    }
    createTaskRole() {
        var _a, _b, _c, _d;
        const policyDocs = ((_b = (_a = this._config.policies) === null || _a === void 0 ? void 0 : _a.where(t => typeof t !== "string")) !== null && _b !== void 0 ? _b : []);
        const managedPolicies = ((_d = (_c = this._config.policies) === null || _c === void 0 ? void 0 : _c.where(t => typeof t === "string")) !== null && _d !== void 0 ? _d : []);
        if (policyDocs.isEmpty)
            return Pulumi.output(awsx.ecs.FargateTaskDefinition.createTaskRole(`${this.name}-tr`, undefined, [
                ...managedPolicies,
                // aws.iam.ManagedPolicy.CloudWatchFullAccess,
                "arn:aws:iam::aws:policy/CloudWatchFullAccessV2",
                "arn:aws:iam::aws:policy/AWSAppMeshEnvoyAccess",
                ...!this.hasDatadog ? [aws.iam.ManagedPolicy.AWSXRayDaemonWriteAccess] : []
            ]));
        const policies = policyDocs.map((policyDoc, index) => {
            const policyName = `${this.name}-tp-${index}`;
            const policy = new aws.iam.Policy(policyName, {
                path: "/",
                policy: policyDoc,
                tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: policyName })
            });
            return policy;
        });
        return Pulumi.all(policies.map(t => t.arn)).apply(resolvedArns => awsx.ecs.FargateTaskDefinition.createTaskRole(`${this.name}-tr`, undefined, [
            ...managedPolicies,
            // aws.iam.ManagedPolicy.CloudWatchFullAccess,
            "arn:aws:iam::aws:policy/CloudWatchFullAccessV2",
            "arn:aws:iam::aws:policy/AWSAppMeshEnvoyAccess",
            ...!this.hasDatadog ? [aws.iam.ManagedPolicy.AWSXRayDaemonWriteAccess] : [],
            ...resolvedArns
        ], { dependsOn: policies }));
    }
    createAppContainer() {
        return {
            image: `${nfra_config_1.NfraConfig.ecr}/${this.config.image}`,
            essential: true,
            readonlyRootFilesystem: true,
            cpu: 0,
            command: this.config.command ? [...this.config.command, `package.name=${this.name}`] : undefined,
            entryPoint: this.config.entryPoint ? [...this.config.entryPoint, `package.name=${this.name}`] : undefined,
            portMappings: [],
            environment: Pulumi.all([
                ...this.config.envVars != null ? this.config.envVars : [],
                ...this._createInstrumentationEnvironmentVariables()
            ].reverse().distinct(t => t.name).orderBy(t => t.name)
                .map(t => {
                if (typeof t.value === "string")
                    return { name: t.name, value: Pulumi.output(t.value) };
                return t;
            })
                .map(t => t.value.apply(u => ({ name: t.name, value: u })))),
            secrets: this.config.secrets && this.config.secrets.isNotEmpty
                ? Pulumi.all(this.config.secrets
                    .orderBy(t => t.name)
                    .map(t => t.arn.apply(u => ({ name: t.name, valueFrom: u }))))
                : undefined,
            stopTimeout: 45,
            logConfiguration: this._createLogConfiguration(),
            dockerLabels: this.hasDatadog
                ? Object.assign({}, this._createInstrumentationLabels()) : undefined,
            mountPoints: [],
            volumesFrom: [],
            dependsOn: [
                {
                    containerName: "log_router",
                    condition: "HEALTHY"
                },
                {
                    containerName: "envoy",
                    condition: "HEALTHY"
                }
            ]
        };
    }
    createContainerDefinitions(virtualNode, appContainerOverrides) {
        (0, n_defensive_1.given)(virtualNode, "virtualNode").ensureHasValue().ensureIsObject();
        (0, n_defensive_1.given)(appContainerOverrides, "appContainerOverrides").ensureIsObject();
        return this._stringifyContainerDefinitions(Object.assign({ [this.name]: appContainerOverrides != null
                ? Object.assign(Object.assign({}, this.createAppContainer()), appContainerOverrides) : this.createAppContainer() }, this._createInstrumentationContainers(virtualNode)));
    }
    _stringifyContainerDefinitions(containerDefinitions) {
        return Object.entries(containerDefinitions)
            .map(entry => {
            return Object.assign({ name: entry[0] }, entry[1]);
        })
            .map(container => {
            return Object.entries(container)
                .map(entry => {
                const key = JSON.stringify(entry[0]);
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if (entry[1] === undefined)
                    return null;
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                const value = entry[1] != null && entry[1].apply != null && typeof entry[1].apply === "function"
                    ? entry[1].apply((val) => JSON.stringify(val))
                    : JSON.stringify(entry[1]);
                return Pulumi.interpolate `${key}:${value}`;
            })
                .where(t => t != null)
                .reduce((acc, value, index, all) => {
                acc = Pulumi.interpolate `${acc}${index === 0 ? "" : ","}${value}${index === (all.length - 1) ? "}" : ""}`;
                return acc;
            }, Pulumi.interpolate `{`);
        })
            .reduce((acc, value, index, all) => {
            acc = Pulumi.interpolate `${acc}${index === 0 ? "" : ","}${value}${index === (all.length - 1) ? "]" : ""}`;
            return acc;
        }, Pulumi.interpolate `[`);
    }
    _createLogConfiguration() {
        if (this.hasDatadog) {
            return this._config.datadogConfig.apiKey.arn.apply((arn) => {
                return {
                    logDriver: "awsfirelens",
                    options: {
                        "Name": "datadog",
                        "Host": `http-intake.logs.${this._config.datadogConfig.ddHost}`,
                        "TLS": "on",
                        "compress": "gzip",
                        "dd_env": nfra_config_1.NfraConfig.env,
                        "dd_service": this._name,
                        "dd_source": "nodejs",
                        "dd_tags": `env:${nfra_config_1.NfraConfig.env}`,
                        "provider": "ecs"
                    },
                    secretOptions: [{
                            name: "apikey",
                            valueFrom: arn
                        }]
                };
            });
        }
        else {
            return Pulumi.output({
                logDriver: "awsfirelens",
                options: {
                    "Name": "cloudwatch",
                    "region": nfra_config_1.NfraConfig.awsRegion,
                    "log_key": "message",
                    // "log_group_name": this._name,
                    // "log_group_name": "/aws/ecs/containerinsights/$(ecs_cluster)/application",
                    "log_group_name": `/aws/ecs/${nfra_config_1.NfraConfig.env}/${this._name}/application`,
                    "auto_create_group": "true",
                    // "log_stream_name": this._name,
                    "log_stream_name": "$(ecs_task_id)",
                    "retry_limit": "2"
                }
            });
        }
    }
    _createAwsLogsConfiguration(containerName) {
        (0, n_defensive_1.given)(containerName, "containerName").ensureHasValue().ensureIsString();
        return {
            logDriver: "awslogs",
            options: {
                "awslogs-create-group": "true",
                "awslogs-region": nfra_config_1.NfraConfig.awsRegion,
                "awslogs-group": containerName,
                "awslogs-stream-prefix": `ecs/${this.name}`
            }
        };
    }
    _createInstrumentationEnvironmentVariables() {
        const result = [
            { name: "env", value: nfra_config_1.NfraConfig.env }
        ];
        if (this.hasDatadog)
            result.push({ name: "DD_ENV", value: nfra_config_1.NfraConfig.env }, { name: "DD_SERVICE", value: this._name }, { name: "DD_VERSION", value: this._version });
        else
            result.push({ name: "enableXrayTracing", value: "true" });
        return result;
    }
    _createInstrumentationLabels() {
        return {
            "com.datadoghq.tags.env": nfra_config_1.NfraConfig.env,
            "com.datadoghq.tags.service": this._name,
            "com.datadoghq.tags.version": this._version
        };
    }
    _createInstrumentationContainers(vnode) {
        const containers = {
            "log_router": this._createLogRouterContainer(),
            "envoy": this._createEnvoyContainer(vnode)
        };
        if (this.hasDatadog)
            containers["datadog-agent"] = this._createDatadogAgentContainer();
        else
            containers["xray"] = this._createAwsOtelCollectorContainer(); // this._createAwsXrayDaemonContainer();
        return containers;
    }
    _createLogRouterContainer() {
        return {
            image: "public.ecr.aws/aws-observability/aws-for-fluent-bit:2.19.0",
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
    _createEnvoyContainer(vnode) {
        (0, n_defensive_1.given)(vnode, "vnode").ensureHasValue().ensureIsObject();
        return {
            image: "public.ecr.aws/appmesh/aws-appmesh-envoy:v1.24.0.0-prod",
            essential: true,
            readonlyRootFilesystem: false,
            cpu: 300,
            memoryReservation: 256,
            environment: vnode.arn.apply(vnodeArn => {
                return [
                    { name: "APPMESH_RESOURCE_ARN", value: vnodeArn },
                    ...this.hasDatadog
                        ? [
                            { name: "ENABLE_ENVOY_DATADOG_TRACING", value: "1" },
                            { name: "DD_ENV", value: nfra_config_1.NfraConfig.env },
                            { name: "DD_SERVICE", value: this._name }
                            // { name: "DATADOG_TRACER_PORT", value: "8126" },
                            // { name: "DATADOG_TRACER_ADDRESS", value: "127.0.0.1" }, // <- service discovery for the datadog agent
                        ]
                        : [
                            { name: "ENABLE_ENVOY_XRAY_TRACING", value: "1" }
                        ],
                    { name: "ENABLE_ENVOY_STATS_TAGS", value: "1" },
                    { name: "ENABLE_ENVOY_DOG_STATSD", value: "1" },
                    // { name: "ENVOY_LOG_LEVEL", value: "debug" }
                    { name: "ENVOY_LOG_LEVEL", value: "off" },
                    { name: "LISTENER_DRAIN_WAIT_TIME_S", value: "50" }
                ].orderBy(t => t.name);
            }),
            dockerLabels: this.hasDatadog
                ? {
                    "com.datadoghq.ad.logs": `[{"source": "envoy", "service": "${this._name}-envoy"}]`,
                    "com.datadoghq.tags.env": nfra_config_1.NfraConfig.env,
                    "com.datadoghq.tags.service": `${this._name}-envoy`,
                    "com.datadoghq.ad.instances": `[{ "stats_url": "http://%%host%%:9901/stats" }]`,
                    "com.datadoghq.ad.check_names": `["envoy"]`,
                    "com.datadoghq.ad.init_configs": `[{}]`
                }
                : undefined,
            // logConfiguration: this._createLogConfiguration(`${service}-envoy`),
            logConfiguration: this._createAwsLogsConfiguration("envoy"),
            dependsOn: [
                {
                    containerName: this.hasDatadog ? "datadog-agent" : "xray",
                    // condition: "START"
                    condition: "HEALTHY"
                }
            ],
            mountPoints: [],
            // mountPoints: [
            //     {
            //         readOnly: false,
            //         containerPath: "/tmp",
            //         sourceVolume: "tmp-envoy"
            //     },
            //     {
            //         readOnly: false,
            //         containerPath: "/etc",
            //         sourceVolume: "etc-envoy"
            //     }
            // ],
            portMappings: [
                {
                    hostPort: 9901,
                    containerPort: 9901,
                    protocol: "tcp"
                },
                {
                    hostPort: 15000,
                    containerPort: 15000,
                    protocol: "tcp"
                },
                {
                    hostPort: 15001,
                    containerPort: 15001,
                    protocol: "tcp"
                }
            ],
            stopTimeout: 60,
            user: "1337",
            ulimits: [{
                    name: "nofile",
                    hardLimit: 15000,
                    softLimit: 15000
                }],
            volumesFrom: [],
            healthCheck: {
                "command": [
                    "CMD-SHELL", "curl -s http://localhost:9901/server_info | grep state | grep -q LIVE"
                ],
                "retries": 3,
                "timeout": 10,
                "interval": 30,
                "startPeriod": 15
            }
        };
    }
    _createDatadogAgentContainer() {
        (0, n_defensive_1.given)(this, "this").ensure(t => t.hasDatadog, "no datadog config provided");
        return {
            image: "public.ecr.aws/datadog/agent:7.41.0",
            essential: true,
            readonlyRootFilesystem: true,
            cpu: 30,
            memoryReservation: 256,
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
            environment: [
                { name: "DD_SITE", value: this._config.datadogConfig.ddHost },
                { name: "DD_APM_NON_LOCAL_TRAFFIC", value: "true" },
                { name: "ECS_FARGATE", value: "true" },
                { name: "DD_APM_ENABLED", value: "true" },
                { name: "DD_LOGS_ENABLED", value: "true" },
                { name: "DD_DOGSTATSD_NON_LOCAL_TRAFFIC", value: "true" },
                // { name: "DD_API_KEY", value: this._config.datadogConfig!.apiKey },
                // { name: "DD_OTLP_CONFIG_RECEIVER_PROTOCOLS_GRPC_ENDPOINT", value: "0.0.0.0:4317"}
                { name: "DD_OTLP_CONFIG_RECEIVER_PROTOCOLS_HTTP_ENDPOINT", value: "0.0.0.0:4318" }
            ].orderBy(t => t.name),
            secrets: Pulumi.all([{ name: "DD_API_KEY", arn: this._config.datadogConfig.apiKey.arn }]
                .orderBy(t => t.name)
                .map(t => t.arn.apply(u => ({ name: t.name, valueFrom: u })))),
            dockerLabels: {
                "com.datadoghq.ad.logs": `[{"source": "datadog-agent", "service": "datadog-agent"}]`
            },
            logConfiguration: this._createAwsLogsConfiguration("datadog-agent"),
            mountPoints: [
                {
                    readOnly: false,
                    containerPath: "/etc/datadog-agent",
                    sourceVolume: "etc-datadog_agent"
                }
            ],
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
    // @ts-expect-error: not used atm
    _createAwsXrayDaemonContainer() {
        (0, n_defensive_1.given)(this, "this").ensure(t => !t.hasDatadog, "cannot use Xray when datadog config is provided");
        return {
            image: "public.ecr.aws/xray/aws-xray-daemon:3.3.5",
            essential: true,
            readonlyRootFilesystem: false,
            cpu: 30,
            memoryReservation: 256,
            portMappings: [{
                    hostPort: 2000,
                    containerPort: 2000,
                    protocol: "udp"
                }],
            environment: [],
            logConfiguration: this._createAwsLogsConfiguration("xray"),
            mountPoints: [],
            volumesFrom: [],
            healthCheck: {
                "command": [
                    "CMD-SHELL",
                    "timeout 1 /bin/bash -c \"</dev/udp/localhost/2000\""
                ],
                "retries": 3,
                "timeout": 10,
                "interval": 30,
                "startPeriod": 15
            }
        };
    }
    _createAwsOtelCollectorContainer() {
        (0, n_defensive_1.given)(this, "this").ensure(t => !t.hasDatadog, "cannot use Xray when datadog config is provided");
        return {
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
}
exports.AppProvisioner = AppProvisioner;
//# sourceMappingURL=app-provisioner.js.map