"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpAppProvisioner = void 0;
// import { SecurityGroup } from "@pulumi/awsx/ec2";
const app_provisioner_1 = require("../app-provisioner");
const Pulumi = require("@pulumi/pulumi");
const n_defensive_1 = require("@nivinjoseph/n-defensive");
const infra_config_1 = require("../../infra-config");
// import { Instance as SdInstance, Service as SdService } from "@pulumi/aws/servicediscovery";
const aws = require("@pulumi/aws");
// import { Service as SdService } from "@pulumi/aws/servicediscovery";
// import { VirtualNode, VirtualService } from "@pulumi/aws/appmesh";
// import { TaskDefinition } from "@pulumi/aws/ecs/taskDefinition";
// import { Cluster, Service } from "@pulumi/aws/ecs";
// import { Policy as AsPolicy, Target as AsTarget } from "@pulumi/aws/appautoscaling";
class HttpAppProvisioner extends app_provisioner_1.AppProvisioner {
    constructor(name, vpcDetails, config) {
        super(name, vpcDetails, config);
        (0, n_defensive_1.given)(config, "config").ensureHasStructure({
            ingressSubnetNamePrefixes: ["string"],
            healthCheckPath: "string",
            minCapacity: "number",
            maxCapacity: "number"
        });
    }
    provision() {
        const httpPort = 80;
        const secGroupName = `${this.name}-sg`;
        const secGroup = new aws.ec2.SecurityGroup(secGroupName, {
            vpcId: this.vpcDetails.vpc.id,
            revokeRulesOnDelete: true,
            ingress: [
                {
                    protocol: "tcp",
                    fromPort: httpPort,
                    toPort: httpPort,
                    self: false,
                    cidrBlocks: Pulumi.output(this.vpcDetails.vpc.getSubnets("private"))
                        .apply((subnets) => subnets.where(subnet => this.config.ingressSubnetNamePrefixes.some(prefix => subnet.subnetName.startsWith(prefix)))
                        .map(t => t.subnet.cidrBlock))
                }
            ],
            egress: [{
                    fromPort: 0,
                    toPort: 0,
                    protocol: "-1",
                    cidrBlocks: ["0.0.0.0/0"],
                    ipv6CidrBlocks: ["::/0"]
                }],
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: secGroupName })
        }, {
            replaceOnChanges: ["*"]
        });
        const sdServiceName = `${this.name}-sd-svc`;
        const sdService = new aws.servicediscovery.Service(sdServiceName, {
            name: this.name,
            dnsConfig: {
                namespaceId: this.vpcDetails.privateDnsNamespace.id,
                dnsRecords: [{
                        type: "A",
                        ttl: 300
                    }],
                // routingPolicy: "WEIGHTED" // must be weighted for the below instance to point to load balancer
                routingPolicy: "MULTIVALUE"
            },
            healthCheckCustomConfig: {
                failureThreshold: 1
            },
            forceDestroy: true,
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: sdServiceName })
        }, { dependsOn: this.vpcDetails.privateDnsNamespace });
        // const sdInstanceName = `${this.name}-sd-ins`;
        // new SdInstance(sdInstanceName, {
        //     instanceId: sdInstanceName,
        //     serviceId: sdService.id,
        //     attributes: {
        //         AWS_ALIAS_DNS_NAME: alb.loadBalancer.dnsName,
        //         AWS_INIT_HEALTH_STATUS: "HEALTHY"
        //     }
        // });
        const ecsTaskDefFam = `${infra_config_1.InfraConfig.env}-${this.name}-tdf`;
        const virtualNodeName = `${this.name}-vnode`;
        const virtualNode = new aws.appmesh.VirtualNode(virtualNodeName, {
            name: virtualNodeName,
            meshName: this.vpcDetails.serviceMesh.name,
            spec: {
                listener: {
                    portMapping: {
                        port: httpPort,
                        protocol: "http"
                    },
                    timeout: {
                        http: {
                            perRequest: {
                                value: 90,
                                unit: "s"
                            }
                        }
                    },
                    healthCheck: {
                        healthyThreshold: 3,
                        intervalMillis: 10000,
                        path: this.config.healthCheckPath,
                        port: httpPort,
                        protocol: "http",
                        timeoutMillis: 5000,
                        unhealthyThreshold: 3
                    }
                },
                // logging: { // TODO: turn off access log
                //     accessLog: {
                //         file: {
                //             path: "/dev/stdout",
                //         }
                //     }
                // },
                serviceDiscovery: {
                    awsCloudMap: {
                        namespaceName: this.vpcDetails.privateDnsNamespace.name,
                        serviceName: sdService.name,
                        attributes: {
                            "ECS_TASK_DEFINITION_FAMILY": ecsTaskDefFam
                        }
                    }
                }
            },
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: virtualNodeName })
        }, { dependsOn: [this.vpcDetails.serviceMesh, sdService] });
        const virtualServiceName = `${this.name}-vsvc`;
        new aws.appmesh.VirtualService(virtualServiceName, {
            name: Pulumi.interpolate `${this.name}.${this.vpcDetails.privateDnsNamespace.name}`,
            meshName: this.vpcDetails.serviceMesh.name,
            spec: {
                provider: {
                    virtualNode: {
                        virtualNodeName: virtualNode.name
                    }
                }
            },
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: virtualServiceName })
        }, { dependsOn: virtualNode });
        const taskDefinitionName = `${this.name}-task-def`;
        const taskDefinition = new aws.ecs.TaskDefinition(taskDefinitionName, {
            cpu: this.config.cpu.toString(),
            memory: this.config.memory.toString(),
            executionRoleArn: this.createExecutionRole().arn,
            taskRoleArn: this.createTaskRole().arn,
            requiresCompatibilities: ["FARGATE"],
            runtimePlatform: {
                operatingSystemFamily: "LINUX",
                cpuArchitecture: "X86_64"
            },
            networkMode: "awsvpc",
            family: ecsTaskDefFam,
            proxyConfiguration: {
                type: "APPMESH",
                containerName: "envoy",
                properties: {
                    "IgnoredUID": "1337",
                    "ProxyIngressPort": "15000",
                    "ProxyEgressPort": "15001",
                    "AppPorts": `${httpPort}`,
                    "EgressIgnoredIPs": "169.254.170.2,169.254.169.254"
                }
            },
            volumes: this.hasDatadog
                ? [{ "name": "etc-datadog_agent" }]
                : [],
            containerDefinitions: this.createContainerDefinitions(virtualNode, {
                portMappings: [{
                        hostPort: httpPort,
                        containerPort: httpPort,
                        protocol: "tcp"
                    }]
            }),
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: taskDefinitionName })
        });
        const clusterName = `${this.name}-cluster`;
        const cluster = new aws.ecs.Cluster(clusterName, {
            capacityProviders: ["FARGATE"],
            settings: [
                {
                    name: "containerInsights",
                    value: "enabled"
                }
            ],
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: clusterName })
        });
        const serviceName = `${this.name}-service`;
        const service = new aws.ecs.Service(serviceName, {
            deploymentMinimumHealthyPercent: 0,
            deploymentMaximumPercent: 100,
            // os: "linux",
            launchType: "FARGATE",
            cluster: cluster.arn,
            taskDefinition: taskDefinition.arn,
            networkConfiguration: {
                subnets: Pulumi.output(this.vpcDetails.vpc.getSubnets("private"))
                    .apply((subnets) => subnets.where(t => t.subnetName.startsWith(this.config.subnetNamePrefix))
                    .map(t => t.id)),
                assignPublicIp: false,
                securityGroups: [secGroup.id]
            },
            serviceRegistries: {
                registryArn: sdService.arn
            },
            loadBalancers: this.config.albTargetGroupArn != null
                ? [{
                        targetGroupArn: this.config.albTargetGroupArn,
                        containerName: this.name,
                        containerPort: httpPort
                    }]
                : undefined,
            desiredCount: this.config.minCapacity,
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: serviceName })
        });
        const asTarget = new aws.appautoscaling.Target(`${this.name}-ast`, {
            minCapacity: this.config.minCapacity,
            maxCapacity: this.config.maxCapacity,
            resourceId: Pulumi.interpolate `service/${cluster.name}/${service.name}`,
            scalableDimension: "ecs:service:DesiredCount",
            serviceNamespace: "ecs"
        });
        new aws.appautoscaling.Policy(`${this.name}-asp`, {
            policyType: "TargetTrackingScaling",
            resourceId: asTarget.resourceId,
            scalableDimension: asTarget.scalableDimension,
            serviceNamespace: asTarget.serviceNamespace,
            targetTrackingScalingPolicyConfiguration: {
                targetValue: 75,
                scaleInCooldown: 300,
                scaleOutCooldown: 60,
                predefinedMetricSpecification: {
                    predefinedMetricType: "ECSServiceAverageCPUUtilization"
                }
            }
        });
    }
}
exports.HttpAppProvisioner = HttpAppProvisioner;
//# sourceMappingURL=http-app-provisioner.js.map