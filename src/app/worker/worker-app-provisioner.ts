// import { SecurityGroup } from "@pulumi/awsx/ec2";
import * as awsx from "@pulumi/awsx";
import { AppProvisioner } from "../app-provisioner";
import * as Pulumi from "@pulumi/pulumi";
import { VpcDetails } from "../../vpc/vpc-details";
import { InfraConfig } from "../../infra-config";
// import { Instance as SdInstance, Service as SdService } from "@pulumi/aws/servicediscovery";
// import { Service as SdService } from "@pulumi/aws/servicediscovery";
import * as aws from "@pulumi/aws";
// import { VirtualNode, VirtualService } from "@pulumi/aws/appmesh";
// import { TaskDefinition } from "@pulumi/aws/ecs/taskDefinition";
// import { Cluster, Service } from "@pulumi/aws/ecs";
import { WorkerAppConfig } from "./worker-app-config";


export class WorkerAppProvisioner extends AppProvisioner<WorkerAppConfig>
{
    public constructor(name: string, vpcDetails: VpcDetails, config: WorkerAppConfig)
    {
        super(name, vpcDetails, config);
    }

    
    public provision(): void
    {
        const secGroupName = `${this.name}-sg`;
        const secGroup = new awsx.ec2.SecurityGroup(secGroupName, {
            vpc: this.vpcDetails.vpc,
            egress: [{
                fromPort: 0,
                toPort: 0,
                protocol: "-1",
                cidrBlocks: ["0.0.0.0/0"],
                ipv6CidrBlocks: ["::/0"]
            }],
            tags: {
                ...InfraConfig.tags,
                Name: secGroupName
            }
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
            tags: {
                ...InfraConfig.tags,
                Name: sdServiceName
            }
        });

        const ecsTaskDefFam = `${InfraConfig.env}-${this.name}-tdf`;

        const virtualNodeName = `${this.name}-vnode`;
        const virtualNode = new aws.appmesh.VirtualNode(virtualNodeName, {
            name: virtualNodeName,
            meshName: this.vpcDetails.serviceMesh.name,
            spec: {
                listener: {
                    portMapping: {
                        port: 8080, // arbitrary
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
            tags: {
                ...InfraConfig.tags,
                Name: virtualNodeName
            }
        });

        const virtualServiceName = `${this.name}-vsvc`;
        new aws.appmesh.VirtualService(virtualServiceName, {
            name: Pulumi.interpolate`${this.name}.${this.vpcDetails.privateDnsNamespace.name}`,
            meshName: this.vpcDetails.serviceMesh.name,
            spec: {
                provider: {
                    virtualNode: {
                        virtualNodeName: virtualNode.name
                    }
                }
            },
            tags: {
                ...InfraConfig.tags,
                Name: virtualServiceName
            }
        });

        const taskDefinitionName = `${this.name}-task-def`;
        const taskDefinition = new aws.ecs.TaskDefinition(taskDefinitionName, {
            cpu: this.config.cpu!.toString(), // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-cpu-memory-error.html
            memory: this.config.memory!.toString(),
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
            tags: {
                ...InfraConfig.tags,
                Name: taskDefinitionName
            }
        }, { deleteBeforeReplace: true });

        const clusterName = `${this.name}-cluster`;
        const cluster = new aws.ecs.Cluster(clusterName, {
            capacityProviders: ["FARGATE"],
            settings: [
                {
                    name: "containerInsights",
                    value: "enabled"
                }
            ],
            tags: {
                ...InfraConfig.tags,
                Name: clusterName
            }
        });

        const serviceName = `${this.name}-service`;
        new aws.ecs.Service(serviceName, {
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
            desiredCount: 1,
            tags: {
                ...InfraConfig.tags,
                Name: serviceName
            }
        });
    }
}