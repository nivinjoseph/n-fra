// import { SecurityGroup } from "@pulumi/awsx/ec2";
import { AppProvisioner } from "../app-provisioner";
import { HttpAppConfig } from "./http-app-config";
import * as Pulumi from "@pulumi/pulumi";
import { given } from "@nivinjoseph/n-defensive";
import { VpcDetails } from "../../vpc/vpc-details";
import { InfraConfig } from "../../infra-config";
// import { Instance as SdInstance, Service as SdService } from "@pulumi/aws/servicediscovery";
import * as aws from "@pulumi/aws";
// import { Service as SdService } from "@pulumi/aws/servicediscovery";
// import { VirtualNode, VirtualService } from "@pulumi/aws/appmesh";
// import { TaskDefinition } from "@pulumi/aws/ecs/taskDefinition";
// import { Cluster, Service } from "@pulumi/aws/ecs";
// import { Policy as AsPolicy, Target as AsTarget } from "@pulumi/aws/appautoscaling";


export class HttpAppProvisioner extends AppProvisioner<HttpAppConfig>
{
    public constructor(name: string, vpcDetails: VpcDetails, config: HttpAppConfig)
    {
        super(name, vpcDetails, config);
        
        given(config, "config").ensureHasStructure({
            ingressSubnetNamePrefixes: ["string"],
            healthCheckPath: "string",
            minCapacity: "number",
            maxCapacity: "number"
        });
    }
    
    public provision(): void
    {
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
                    cidrBlocks: Pulumi.output(this.vpcDetails.vpc.getSubnets(
                        this.config.albTargetGroupArn != null ? "public" : "private"))
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
                ...InfraConfig.tags,
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
                ...InfraConfig.tags,
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

        const ecsTaskDefFam = `${InfraConfig.env}-${this.name}-tdf`;
        
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
            tags: {
                ...InfraConfig.tags,
                Name: virtualNodeName
            }
        }, { dependsOn: [this.vpcDetails.serviceMesh, sdService] });

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
        }, { dependsOn: virtualNode });
        
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
            tags: {
                ...InfraConfig.tags,
                Name: taskDefinitionName
            }
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
            tags: {
                ...InfraConfig.tags,
                Name: clusterName
            }
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
            tags: {
                ...InfraConfig.tags,
                Name: serviceName
            }
        });
        
        const asTarget = new aws.appautoscaling.Target(`${this.name}-ast`, {
            minCapacity: this.config.minCapacity,
            maxCapacity: this.config.maxCapacity,
            resourceId: Pulumi.interpolate`service/${cluster.name}/${service.name}`,
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