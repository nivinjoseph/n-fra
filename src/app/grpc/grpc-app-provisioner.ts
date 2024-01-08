// import { SecurityGroup } from "@pulumi/awsx/ec2";
import { AppProvisioner } from "../app-provisioner.js";
import * as Pulumi from "@pulumi/pulumi";
import { given } from "@nivinjoseph/n-defensive";
import { NfraConfig } from "../../nfra-config.js";
// import { Instance as SdInstance, Service as SdService } from "@pulumi/aws/servicediscovery";
// import { Service as SdService } from "@pulumi/aws/servicediscovery";
import * as aws from "@pulumi/aws";
// import { VirtualNode, VirtualService } from "@pulumi/aws/appmesh";
// import { TaskDefinition } from "@pulumi/aws/ecs/taskDefinition";
// import { Cluster, Service } from "@pulumi/aws/ecs";
// import { Policy as AsPolicy, Target as AsTarget } from "@pulumi/aws/appautoscaling";
import { GrpcAppConfig } from "./grpc-app-config.js";
import { GrpcAppDetails } from "./grpc-app-details.js";
// import { AppDetails } from "../app-details";


export class GrpcAppProvisioner extends AppProvisioner<GrpcAppConfig>
{
    public constructor(name: string, config: GrpcAppConfig)
    {
        super(name, config);

        given(config, "config").ensureHasStructure({
            ingressSubnetNamePrefixes: ["string"],
            healthCheckPath: "string",
            minCapacity: "number",
            maxCapacity: "number"
        });
    }

    public provision(): GrpcAppDetails
    {
        const grpcPort = 50051;

        const secGroupName = `${this.name}-sg`;
        const secGroup = new aws.ec2.SecurityGroup(secGroupName, {
            vpcId: this.vpcDetails.vpc.id,
            revokeRulesOnDelete: true,
            ingress: [
                {
                    protocol: "tcp",
                    fromPort: grpcPort,
                    toPort: grpcPort,
                    cidrBlocks: Pulumi.output(this.vpcDetails.vpc.getSubnets("private"))
                        .apply((subnets) =>
                            subnets.where(subnet =>
                                this.config.ingressSubnetNamePrefixes.some(prefix =>
                                    subnet.subnetName.startsWith(prefix)))
                                .map(t => t.subnet.cidrBlock as Pulumi.Output<string>))
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
            tags: {
                ...NfraConfig.tags,
                Name: sdServiceName
            }
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

        const ecsTaskDefFam = `${NfraConfig.env}-${this.name}-tdf`;

        const virtualNodeName = `${this.name}-vnode`;
        const virtualNode = new aws.appmesh.VirtualNode(virtualNodeName, {
            name: virtualNodeName,
            meshName: this.vpcDetails.serviceMesh.name,
            spec: {
                listener: {
                    portMapping: {
                        port: grpcPort,
                        protocol: "grpc"
                    },
                    timeout: {
                        grpc: {
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
                        port: grpcPort,
                        protocol: "grpc",
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
            tags: {
                ...NfraConfig.tags,
                Name: virtualNodeName
            }
        }, { dependsOn: [this.vpcDetails.serviceMesh, this.vpcDetails.privateDnsNamespace, sdService] });

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
                ...NfraConfig.tags,
                Name: virtualServiceName
            }
        }, { dependsOn: [this.vpcDetails.serviceMesh, this.vpcDetails.privateDnsNamespace, virtualNode] });

        const taskRoleArn = this.createTaskRole().arn;
        
        const taskDefinitionName = `${this.name}-task-def`;
        const taskDefinition = new aws.ecs.TaskDefinition(taskDefinitionName, {
            cpu: this.config.cpu!.toString(), // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-cpu-memory-error.html
            memory: this.config.memory!.toString(),
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
                    "AppPorts": `${grpcPort}`,
                    "EgressIgnoredIPs": "169.254.170.2,169.254.169.254"
                }
            },
            volumes: this.hasDatadog
                ? [{ "name": "etc-datadog_agent" }]
                : [],
            containerDefinitions: this.createContainerDefinitions(virtualNode, {
                portMappings: [{
                    hostPort: grpcPort,
                    containerPort: grpcPort,
                    protocol: "tcp"
                }]
            }),
            tags: {
                ...NfraConfig.tags,
                Name: taskDefinitionName
            }
        }, { dependsOn: virtualNode });

        const cluster = this.createAppCluster();

        const serviceName = `${this.name}-service`;
        const service = new aws.ecs.Service(serviceName, {
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
            desiredCount: this.config.minCapacity,
            tags: {
                ...NfraConfig.tags,
                Name: serviceName
            }
        });

        const asTarget = new aws.appautoscaling.Target(`${this.name}-ast`, {
            minCapacity: this.config.minCapacity,
            maxCapacity: this.config.maxCapacity,
            resourceId: Pulumi.interpolate`service/${cluster.clusterName}/${service.name}`,
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
        
        return {
            // taskRoleArn
            host: `${this.name}.${this.vpcDetails.privateDnsDomain}`,
            port: grpcPort
        };
    }
}