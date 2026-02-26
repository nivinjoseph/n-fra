// import * as Pulumi from "@pulumi/pulumi";
import { NfraConfig } from "../../common/nfra-config.js";
import { AppProvisioner } from "../app-provisioner.js";
// import { Instance as SdInstance, Service as SdService } from "@pulumi/aws/servicediscovery";
// import { Service as SdService } from "@pulumi/aws/servicediscovery";
import * as aws from "@pulumi/aws";
// import { VirtualNode, VirtualService } from "@pulumi/aws/appmesh";
// import { TaskDefinition } from "@pulumi/aws/ecs/taskDefinition";
// import { Cluster, Service } from "@pulumi/aws/ecs";
// import { VirtualNode, VirtualService } from "@pulumi/aws/appmesh";
// import { TaskDefinition } from "@pulumi/aws/ecs/taskDefinition";
// import { Cluster, Service } from "@pulumi/aws/ecs";
import type { WorkerAppConfig } from "./worker-app-config.js";
import type { WorkerAppDetails } from "./worker-app-details.js";
import { resolveAppCompute } from "../app-compute-profile.js";
// import { AppDetails } from "../app-details";


export class WorkerAppProvisioner extends AppProvisioner<WorkerAppConfig, WorkerAppDetails>
{
    public constructor(name: string, config: WorkerAppConfig)
    {
        super(name, config);
    }


    protected override provisionApp(): WorkerAppDetails
    {
        const secGroupName = `${this.name}-app-sg`;
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
            tags: {
                ...NfraConfig.tags,
                Name: secGroupName
            }
        }, {
            // replaceOnChanges: ["*"]
        });

        // const sdServiceName = `${this.name}-sd-svc`;
        // const sdService = new aws.servicediscovery.Service(sdServiceName, {
        //     name: this.name,
        //     dnsConfig: {
        //         namespaceId: this.vpcDetails.privateDnsNamespace.id,
        //         dnsRecords: [{
        //             type: "A",
        //             ttl: 300
        //         }],
        //         routingPolicy: "MULTIVALUE"
        //     },
        //     healthCheckCustomConfig: {
        //         failureThreshold: 1
        //     },
        //     forceDestroy: true,
        //     tags: {
        //         ...NfraConfig.tags,
        //         Name: sdServiceName,
        //         ...this.config.tags ?? {}
        //     }
        // }, { dependsOn: this.vpcDetails.privateDnsNamespace });

        const ecsTaskDefFam = `${this.name}-tsk-def-fam`;

        // const virtualNodeName = `${this.name}-vnode`;
        // const virtualNode = new aws.appmesh.VirtualNode(virtualNodeName, {
        //     name: virtualNodeName,
        //     meshName: this.vpcDetails.serviceMesh.name,
        //     spec: {
        //         listeners: [{
        //             portMapping: {
        //                 port: 8080, // arbitrary
        //                 protocol: "tcp"
        //             }
        //         }],
        //         // listener: {
        //         //     portMapping: {
        //         //         port: 8080, // arbitrary
        //         //         protocol: "tcp"
        //         //     }
        //         // },
        //         // logging: { // TODO: turn off access log
        //         //     accessLog: {
        //         //         file: {
        //         //             path: "/dev/stdout",
        //         //         }
        //         //     }
        //         // },
        //         serviceDiscovery: {
        //             awsCloudMap: {
        //                 namespaceName: this.vpcDetails.privateDnsNamespace.name,
        //                 serviceName: sdService.name,
        //                 attributes: {
        //                     "ECS_TASK_DEFINITION_FAMILY": ecsTaskDefFam
        //                 }
        //             }
        //         }
        //     },
        //     tags: {
        //         ...NfraConfig.tags,
        //         Name: virtualNodeName,
        //         ...this.config.tags ?? {}
        //     }
        // }, { dependsOn: [this.vpcDetails.serviceMesh, this.vpcDetails.privateDnsNamespace, sdService] });

        // const virtualServiceName = `${this.name}-vsvc`;
        // new aws.appmesh.VirtualService(virtualServiceName, {
        //     name: Pulumi.interpolate`${this.name}.${this.vpcDetails.privateDnsNamespace.name}`,
        //     meshName: this.vpcDetails.serviceMesh.name,
        //     spec: {
        //         provider: {
        //             virtualNode: {
        //                 virtualNodeName: virtualNode.name
        //             }
        //         }
        //     },
        //     tags: {
        //         ...NfraConfig.tags,
        //         Name: virtualServiceName,
        //         ...this.config.tags ?? {}
        //     }
        // }, { dependsOn: [this.vpcDetails.serviceMesh, this.vpcDetails.privateDnsNamespace, virtualNode] });

        const { cpu, memory } = this.config.customCompute != null
            ? this.config.customCompute
            : resolveAppCompute(this.config.computeProfile!);
        
        const healthCheckPort = 8080;
        const portName = `${this.name}-healthcheck-${healthCheckPort}`;
        
        const taskDefinitionName = `${this.name}-tsk-def`;
        const taskDefinition = new aws.ecs.TaskDefinition(taskDefinitionName, {
            cpu: cpu.toString(),
            memory: memory.toString(),
            executionRoleArn: this.createExecutionRole().arn,
            taskRoleArn: this.createTaskRole().arn,
            requiresCompatibilities: ["FARGATE"],
            runtimePlatform: {
                operatingSystemFamily: "LINUX",
                cpuArchitecture: this.config.cpuArchitecture
            },
            networkMode: "awsvpc",
            family: ecsTaskDefFam,
            // proxyConfiguration: {
            //     type: "APPMESH",
            //     containerName: "envoy",
            //     properties: {
            //         "IgnoredUID": "1337",
            //         "ProxyIngressPort": "15000",
            //         "ProxyEgressPort": "15001",
            //         "AppPorts": `8080`,
            //         "EgressIgnoredIPs": "169.254.170.2,169.254.169.254"
            //     }
            // },
            volumes: this.createTaskVolumeConfiguration(),
            containerDefinitions: this.createContainerDefinitions(
                // virtualNode
                {
                    portMappings: [{
                        name: portName,
                        hostPort: healthCheckPort,
                        containerPort: healthCheckPort,
                        protocol: "tcp",
                        appProtocol: "http"
                    }],
                    healthCheck: {
                        "command": [
                            "CMD-SHELL",
                            `curl -f http://localhost:${healthCheckPort}/healthCheck || exit 1`
                        ],
                        "interval": 30,
                        "timeout": 30,
                        "retries": 5,
                        "startPeriod": 30
                    }
                }
            ),
            tags: {
                ...NfraConfig.tags,
                Name: taskDefinitionName,
                ...this.config.tags ?? {}
            }
        }, {
            deleteBeforeReplace: true
            // dependsOn: virtualNode
        });

        const cluster = this.createAppCluster();

        const serviceSubnets = this.vpcDetails
            .resolveSubnets([this.config.subnetNamePrefix])
            .map(u => u.id);
            // .apply(t => t.map(u => u.id));
        
        const serviceName = `${this.name}-svc`;
        const service = new aws.ecs.Service(serviceName, {
            deploymentMinimumHealthyPercent: 0,
            deploymentMaximumPercent: 100,
            // os: "linux",
            launchType: "FARGATE",
            cluster: cluster.clusterArn,
            taskDefinition: taskDefinition.arn,
            networkConfiguration: {
                subnets: serviceSubnets,
                assignPublicIp: false,
                securityGroups: [secGroup.id]
            },
            serviceConnectConfiguration: {
                enabled: true,
                namespace: this.vpcDetails.privateDnsNamespace.arn,
                services: [{
                    portName,
                    discoveryName: this.name,
                    clientAlias: [{
                        port: healthCheckPort,
                        dnsName: this.name
                    }],
                    timeout: {
                        idleTimeoutSeconds: 10 * 60,
                        perRequestTimeoutSeconds: 0
                    }
                }]
            },
            // serviceRegistries: {
            //     registryArn: sdService.arn
            // },
            
            desiredCount: this.config.minCapacity,
            tags: {
                ...NfraConfig.tags,
                Name: serviceName,
                ...this.config.tags ?? {}
            }
        });
        
        this.configureAutoScaling(cluster, service);

        return {
            // taskRoleArn
        };
    }
}