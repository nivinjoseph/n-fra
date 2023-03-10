"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerAppProvisioner = void 0;
// import { SecurityGroup } from "@pulumi/awsx/ec2";
const app_provisioner_1 = require("../app-provisioner");
const Pulumi = require("@pulumi/pulumi");
const nfra_config_1 = require("../../nfra-config");
// import { Instance as SdInstance, Service as SdService } from "@pulumi/aws/servicediscovery";
// import { Service as SdService } from "@pulumi/aws/servicediscovery";
const aws = require("@pulumi/aws");
// import { AppDetails } from "../app-details";
class WorkerAppProvisioner extends app_provisioner_1.AppProvisioner {
    constructor(name, config) {
        super(name, config);
    }
    provision() {
        const secGroupName = `${this.name}-sg`;
        const secGroup = new aws.ec2.SecurityGroup(secGroupName, {
            vpcId: this.vpcDetails.vpc.id,
            revokeRulesOnDelete: true,
            egress: [{
                    fromPort: 0,
                    toPort: 0,
                    protocol: "-1",
                    cidrBlocks: ["0.0.0.0/0"],
                    ipv6CidrBlocks: ["::/0"]
                }],
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: secGroupName })
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
                routingPolicy: "MULTIVALUE"
            },
            healthCheckCustomConfig: {
                failureThreshold: 1
            },
            forceDestroy: true,
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: sdServiceName })
        }, { dependsOn: this.vpcDetails.privateDnsNamespace });
        const ecsTaskDefFam = `${nfra_config_1.NfraConfig.env}-${this.name}-tdf`;
        const virtualNodeName = `${this.name}-vnode`;
        const virtualNode = new aws.appmesh.VirtualNode(virtualNodeName, {
            name: virtualNodeName,
            meshName: this.vpcDetails.serviceMesh.name,
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
                        namespaceName: this.vpcDetails.privateDnsNamespace.name,
                        serviceName: sdService.name,
                        attributes: {
                            "ECS_TASK_DEFINITION_FAMILY": ecsTaskDefFam
                        }
                    }
                }
            },
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: virtualNodeName })
        }, { dependsOn: [this.vpcDetails.serviceMesh, this.vpcDetails.privateDnsNamespace, sdService] });
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
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: virtualServiceName })
        }, { dependsOn: [this.vpcDetails.serviceMesh, this.vpcDetails.privateDnsNamespace, virtualNode] });
        const taskRoleArn = this.createTaskRole().arn;
        const taskDefinitionName = `${this.name}-task-def`;
        const taskDefinition = new aws.ecs.TaskDefinition(taskDefinitionName, {
            cpu: this.config.cpu.toString(),
            memory: this.config.memory.toString(),
            executionRoleArn: this.createExecutionRole().arn,
            taskRoleArn,
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
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: taskDefinitionName })
        }, { deleteBeforeReplace: true, dependsOn: virtualNode });
        const cluster = this.createAppCluster();
        const serviceName = `${this.name}-service`;
        new aws.ecs.Service(serviceName, {
            deploymentMinimumHealthyPercent: 0,
            deploymentMaximumPercent: 100,
            // os: "linux",
            launchType: "FARGATE",
            cluster: cluster.clusterArn,
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
            desiredCount: 1,
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: serviceName })
        });
        return {
        // taskRoleArn
        };
    }
}
exports.WorkerAppProvisioner = WorkerAppProvisioner;
//# sourceMappingURL=worker-app-provisioner.js.map