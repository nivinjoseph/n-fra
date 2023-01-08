"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerAppProvisioner = void 0;
const ec2_1 = require("@pulumi/awsx/ec2");
const app_provisioner_1 = require("../app-provisioner");
const Pulumi = require("@pulumi/pulumi");
const infra_config_1 = require("../../infra-config");
// import { Instance as SdInstance, Service as SdService } from "@pulumi/aws/servicediscovery";
const servicediscovery_1 = require("@pulumi/aws/servicediscovery");
const appmesh_1 = require("@pulumi/aws/appmesh");
const taskDefinition_1 = require("@pulumi/aws/ecs/taskDefinition");
const ecs_1 = require("@pulumi/aws/ecs");
class WorkerAppProvisioner extends app_provisioner_1.AppProvisioner {
    constructor(name, vpcInfo, config) {
        super(name, vpcInfo, config);
    }
    provision() {
        const secGroupName = `${this.name}-sg`;
        const secGroup = new ec2_1.SecurityGroup(secGroupName, {
            vpc: this.vpcInfo.vpc,
            egress: [{
                    fromPort: 0,
                    toPort: 0,
                    protocol: "-1",
                    cidrBlocks: ["0.0.0.0/0"],
                    ipv6CidrBlocks: ["::/0"]
                }],
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: secGroupName })
        });
        const sdServiceName = `${this.name}-sd-svc`;
        const sdService = new servicediscovery_1.Service(sdServiceName, {
            name: this.name,
            dnsConfig: {
                namespaceId: this.vpcInfo.privateDnsNamespace.id,
                dnsRecords: [{
                        type: "A",
                        ttl: 300
                    }],
                routingPolicy: "MULTIVALUE"
            },
            healthCheckCustomConfig: {
                failureThreshold: 1
            },
            forceDestroy: true,
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: sdServiceName })
        });
        const ecsTaskDefFam = `${infra_config_1.InfraConfig.env}-${this.name}-tdf`;
        const virtualNodeName = `${this.name}-vnode`;
        const virtualNode = new appmesh_1.VirtualNode(virtualNodeName, {
            name: virtualNodeName,
            meshName: this.vpcInfo.serviceMesh.name,
            spec: {
                listener: {
                    portMapping: {
                        port: 8080,
                        protocol: "tcp"
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
                        namespaceName: this.vpcInfo.privateDnsNamespace.name,
                        serviceName: sdService.name,
                        attributes: {
                            "ECS_TASK_DEFINITION_FAMILY": ecsTaskDefFam
                        }
                    }
                }
            },
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: virtualNodeName })
        });
        const virtualServiceName = `${this.name}-vsvc`;
        new appmesh_1.VirtualService(virtualServiceName, {
            name: Pulumi.interpolate `${this.name}.${this.vpcInfo.privateDnsNamespace.name}`,
            meshName: this.vpcInfo.serviceMesh.name,
            spec: {
                provider: {
                    virtualNode: {
                        virtualNodeName: virtualNode.name
                    }
                }
            },
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: virtualServiceName })
        });
        const taskDefinitionName = `${this.name}-task-def`;
        const taskDefinition = new taskDefinition_1.TaskDefinition(taskDefinitionName, {
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
                    "AppPorts": `8080`,
                    "EgressIgnoredIPs": "169.254.170.2,169.254.169.254"
                }
            },
            volumes: this.hasDatadog
                ? [{ "name": "etc-datadog_agent" }]
                : [],
            containerDefinitions: this.createContainerDefinitions(virtualNode),
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: taskDefinitionName })
        }, { deleteBeforeReplace: true });
        const clusterName = `${this.name}-cluster`;
        const cluster = new ecs_1.Cluster(clusterName, {
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
        new ecs_1.Service(serviceName, {
            deploymentMinimumHealthyPercent: 0,
            deploymentMaximumPercent: 100,
            // os: "linux",
            launchType: "FARGATE",
            cluster: cluster.arn,
            taskDefinition: taskDefinition.arn,
            networkConfiguration: {
                subnets: Pulumi.output(this.vpcInfo.vpc.getSubnets("private"))
                    .apply((subnets) => subnets.where(t => t.subnetName.startsWith(this.config.subnetNamePrefix))
                    .map(t => t.id)),
                assignPublicIp: false,
                securityGroups: [secGroup.id]
            },
            serviceRegistries: {
                registryArn: sdService.arn
            },
            desiredCount: 1,
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: serviceName })
        });
    }
}
exports.WorkerAppProvisioner = WorkerAppProvisioner;
//# sourceMappingURL=worker-app-provisioner.js.map