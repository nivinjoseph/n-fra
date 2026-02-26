import { given } from "@nivinjoseph/n-defensive";
// import * as Pulumi from "@pulumi/pulumi";
import { NfraConfig } from "../../common/nfra-config.js";
import { AppProvisioner } from "../app-provisioner.js";
// import { Instance as SdInstance, Service as SdService } from "@pulumi/aws/servicediscovery";
// import { Service as SdService } from "@pulumi/aws/servicediscovery";
import * as aws from "@pulumi/aws";
// import { VirtualNode, VirtualService } from "@pulumi/aws/appmesh";
// import { TaskDefinition } from "@pulumi/aws/ecs/taskDefinition";
// import { Cluster, Service } from "@pulumi/aws/ecs";
// import { Policy as AsPolicy, Target as AsTarget } from "@pulumi/aws/appautoscaling";
// import { VirtualNode, VirtualService } from "@pulumi/aws/appmesh";
// import { TaskDefinition } from "@pulumi/aws/ecs/taskDefinition";
// import { Cluster, Service } from "@pulumi/aws/ecs";
// import { Policy as AsPolicy, Target as AsTarget } from "@pulumi/aws/appautoscaling";
import type { GrpcAppConfig } from "./grpc-app-config.js";
import type { GrpcAppDetails } from "./grpc-app-details.js";
import { resolveAppCompute } from "../app-compute-profile.js";
// import { AppDetails } from "../app-details";


export class GrpcAppProvisioner extends AppProvisioner<GrpcAppConfig, GrpcAppDetails>
{
    public constructor(name: string, config: GrpcAppConfig)
    {
        super(name, config);

        given(config, "config").ensureHasStructure({
            ingressSubnetNamePrefixes: ["string"],
            // healthCheckPath: "string"
        });
    }

    protected override provisionApp(): GrpcAppDetails
    {
        const grpcPort = 50051;

        const ingressCidrBlocks = this.vpcDetails
            .resolveSubnets(this.config.ingressSubnetNamePrefixes)
            .map(u => u.cidrBlock);
        // .apply(subnets => subnets.map(u => u.cidrBlock));

        const secGroupName = `${this.name}-app-sg`;
        const secGroup = new aws.ec2.SecurityGroup(secGroupName, {
            vpcId: this.vpcDetails.vpc.id,
            revokeRulesOnDelete: true,
            ingress: [
                {
                    protocol: "tcp",
                    fromPort: grpcPort,
                    toPort: grpcPort,
                    cidrBlocks: ingressCidrBlocks
                }
            ],
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
        //         // routingPolicy: "WEIGHTED" // must be weighted for the below instance to point to load balancer
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

        // const sdInstanceName = `${this.name}-sd-ins`;
        // new SdInstance(sdInstanceName, {
        //     instanceId: sdInstanceName,
        //     serviceId: sdService.id,
        //     attributes: {
        //         AWS_ALIAS_DNS_NAME: alb.loadBalancer.dnsName,
        //         AWS_INIT_HEALTH_STATUS: "HEALTHY"
        //     }
        // });

        const ecsTaskDefFam = `${this.name}-tsk-def-fam`;

        // const virtualNodeName = `${this.name}-vnode`;
        // const virtualNode = new aws.appmesh.VirtualNode(virtualNodeName, {
        //     name: virtualNodeName,
        //     meshName: this.vpcDetails.serviceMesh.name,
        //     spec: {
        //         listeners: [{
        //             portMapping: {
        //                 port: grpcPort,
        //                 protocol: "grpc"
        //             },
        //             timeout: {
        //                 grpc: {
        //                     perRequest: {
        //                         value: 90,
        //                         unit: "s"
        //                     }
        //                 }
        //             },
        //             healthCheck: {
        //                 healthyThreshold: 3,
        //                 intervalMillis: 10000,
        //                 path: this.config.healthCheckPath,
        //                 port: grpcPort,
        //                 protocol: "grpc",
        //                 timeoutMillis: 5000,
        //                 unhealthyThreshold: 3
        //             }
        //         }],
        //         // listener: {
        //         //     portMapping: {
        //         //         port: grpcPort,
        //         //         protocol: "grpc"
        //         //     },
        //         //     timeout: {
        //         //         grpc: {
        //         //             perRequest: {
        //         //                 value: 90,
        //         //                 unit: "s"
        //         //             }
        //         //         }
        //         //     },
        //         //     healthCheck: {
        //         //         healthyThreshold: 3,
        //         //         intervalMillis: 10000,
        //         //         path: this.config.healthCheckPath,
        //         //         port: grpcPort,
        //         //         protocol: "grpc",
        //         //         timeoutMillis: 5000,
        //         //         unhealthyThreshold: 3
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

        const portName = `${this.name}-grpc-${grpcPort}`;
        
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
            //         "AppPorts": `${grpcPort}`,
            //         "EgressIgnoredIPs": "169.254.170.2,169.254.169.254"
            //     }
            // },
            volumes: this.createTaskVolumeConfiguration(),
            containerDefinitions: this.createContainerDefinitions(
                // virtualNode,
                {
                    portMappings: [{
                        name: portName,
                        hostPort: grpcPort,
                        containerPort: grpcPort,
                        protocol: "tcp",
                        appProtocol: "grpc"
                    }],
                    healthCheck: {
                        command: [
                            "CMD-SHELL",
                            `/usr/local/bin/grpc-health-probe -addr=:${grpcPort} -service=grpc.health.v1.Health`
                        ],
                        "interval": 30,
                        "timeout": 30,
                        "retries": 5,
                        "startPeriod": 30
                    }
                }),
            tags: {
                ...NfraConfig.tags,
                Name: taskDefinitionName,
                ...this.config.tags ?? {}
            }
        }
            // { dependsOn: virtualNode }
        );

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
            // serviceRegistries: {
            //     registryArn: sdService.arn,
            //     containerName: this.name,
            //     containerPort: grpcPort
            // },
            serviceConnectConfiguration: {
                enabled: true,
                namespace: this.vpcDetails.privateDnsNamespace.arn,
                services: [{
                    portName,
                    discoveryName: this.name,
                    clientAlias: [{
                        port: grpcPort,
                        dnsName: this.name
                    }],
                    timeout: {
                        idleTimeoutSeconds: 10 * 60,
                        perRequestTimeoutSeconds: 0
                    }
                }]
            },
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
            // host: `${this.name}.${this.vpcDetails.privateDnsDomain}`, // service discovery
            host: this.name, // service connect
            port: grpcPort
        };
    }
}