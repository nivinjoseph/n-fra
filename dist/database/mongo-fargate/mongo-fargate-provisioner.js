// import { given } from "@nivinjoseph/n-defensive";
// import { AppProvisioner } from "../../app/app-provisioner.js";
// import { MongoFargateConfig } from "./mongo-fargate-config.js";
// import { MongoFargateDetails } from "./mongo-fargate-details.js";
// import * as aws from "@pulumi/aws";
// import { NfraConfig } from "../../common/nfra-config.js";
// import * as Pulumi from "@pulumi/pulumi";
// import { AppComputeProfile, resolveAppCompute } from "../../app/app-compute-profile.js";
// import { EfsAccessPointDetails } from "../../storage/efs/efs-access-point-details.js";
// import { EfsProvisioner } from "../../storage/efs/efs-provisioner.js";
// import * as awsx from "../../pulumi-awsx/index.js";
export {};
// export class MongoFargateProvisioner extends AppProvisioner<MongoFargateConfig, MongoFargateDetails>
// {
//     private readonly _mongoPort = 27017;
//     public constructor(name: string, config: MongoFargateConfig)
//     {
//         given(name, "name").ensureHasValue().ensureIsString();
//         name = name.trim();
//         if (!name.contains("mongo"))
//             name += "-mongo";
//         given(config, "config").ensureHasValue().ensureHasStructure({
//             ingressSubnetNamePrefixes: ["string"],
//             username: "string",
//             password: "string"
//         });
//         config.clusterConfig = {
//             enableContainerInsights: true
//         };
//         config.computeProfile ??= AppComputeProfile.large;
//         // config.image = `public.ecr.aws/docker/library/mongo:${"5.0.24"}`;
//         config.useDockerfileCommandOrEntryPoint = true;
//         config.envVars = [
//             { name: "TZ", value: "UTC" },
//             { name: "MONGO_INITDB_ROOT_USERNAME", value: config.username },
//             { name: "MONGO_INITDB_ROOT_PASSWORD", value: config.password }
//         ];
//         config.minCapacity = 1;
//         config.maxCapacity = 1;
//         super(name, config);
//         if (config.datadogConfig != null)
//         {
//             config.datadogConfig.additionalInstrumentationLabels = {
//                 "com.datadoghq.ad.check_names": `["mongo"]`,
//                 "com.datadoghq.ad.init_configs": "[{}]",
//                 "com.datadoghq.ad.instances": `[{"hosts": ["%%host%%:${this._mongoPort}"], "username": "${config.username}", "password": "${config.password}", "database": "admin"}]`
//             };
//             // config.datadogConfig.containerMountPoints = [
//             //     { sourceVolume: "DD_full_access_mongodb", containerPath: "/mongodb" }
//             // ];
//         }
//     }
//     protected override provisionApp(): MongoFargateDetails
//     {
//         const ingressCidrBlocks = this.vpcDetails
//             .resolveSubnets(this.config.ingressSubnetNamePrefixes)
//             .apply(subnets => subnets.map(u => u.cidrBlock));
//         const secGroupName = `${this.name}-sg`;
//         const secGroup = new aws.ec2.SecurityGroup(secGroupName, {
//             vpcId: this.vpcDetails.vpc.id,
//             revokeRulesOnDelete: true,
//             ingress: [
//                 {
//                     protocol: "tcp",
//                     fromPort: this._mongoPort,
//                     toPort: this._mongoPort,
//                     cidrBlocks: ingressCidrBlocks
//                 }
//             ],
//             egress: [{
//                 fromPort: 0,
//                 toPort: 0,
//                 protocol: "-1",
//                 cidrBlocks: ["0.0.0.0/0"],
//                 ipv6CidrBlocks: ["::/0"]
//             }],
//             tags: {
//                 ...NfraConfig.tags,
//                 Name: secGroupName
//             }
//         }, {
//             // replaceOnChanges: ["*"]
//         });
//         const sdServiceName = `${this.name}-sd-svc`;
//         const sdService = new aws.servicediscovery.Service(sdServiceName, {
//             name: this.name,
//             dnsConfig: {
//                 namespaceId: this.vpcDetails.privateDnsNamespace.id,
//                 dnsRecords: [{
//                     type: "A",
//                     ttl: 300
//                 }],
//                 // routingPolicy: "WEIGHTED" // must be weighted for the below instance to point to load balancer
//                 routingPolicy: "MULTIVALUE"
//             },
//             healthCheckCustomConfig: {
//                 failureThreshold: 1
//             },
//             forceDestroy: true,
//             tags: {
//                 ...NfraConfig.tags,
//                 Name: sdServiceName
//             }
//         }, { dependsOn: this.vpcDetails.privateDnsNamespace });
//         const ecsTaskDefFam = `${this.name}-tsk-def-fam`;
//         // const virtualNodeName = `${this.name}-vnode`;
//         // const virtualNode = new aws.appmesh.VirtualNode(virtualNodeName, {
//         //     name: virtualNodeName,
//         //     meshName: this.vpcDetails.serviceMesh.name,
//         //     spec: {
//         //         listeners: [{
//         //             portMapping: {
//         //                 port: this._mongoPort,
//         //                 protocol: "tcp"
//         //             },
//         //             healthCheck: {
//         //                 healthyThreshold: 3,
//         //                 intervalMillis: 10000,
//         //                 port: this._mongoPort,
//         //                 protocol: "tcp",
//         //                 timeoutMillis: 5000,
//         //                 unhealthyThreshold: 3
//         //             }
//         //         }],
//         //         serviceDiscovery: {
//         //             awsCloudMap: {
//         //                 namespaceName: this.vpcDetails.privateDnsNamespace.name,
//         //                 serviceName: sdService.name,
//         //                 attributes: {
//         //                     "ECS_TASK_DEFINITION_FAMILY": ecsTaskDefFam
//         //                 }
//         //             }
//         //         }
//         //     },
//         //     tags: {
//         //         ...NfraConfig.tags,
//         //         Name: virtualNodeName
//         //     }
//         // }, { dependsOn: [this.vpcDetails.serviceMesh, this.vpcDetails.privateDnsNamespace, sdService] });
//         // const virtualServiceName = `${this.name}-vsvc`;
//         // new aws.appmesh.VirtualService(virtualServiceName, {
//         //     name: Pulumi.interpolate`${this.name}.${this.vpcDetails.privateDnsNamespace.name}`,
//         //     meshName: this.vpcDetails.serviceMesh.name,
//         //     spec: {
//         //         provider: {
//         //             virtualNode: {
//         //                 virtualNodeName: virtualNode.name
//         //             }
//         //         }
//         //     },
//         //     tags: {
//         //         ...NfraConfig.tags,
//         //         Name: virtualServiceName
//         //     }
//         // }, { dependsOn: [this.vpcDetails.serviceMesh, this.vpcDetails.privateDnsNamespace, virtualNode] });
//         const { cpu, memory } = this.config.customCompute != null
//             ? this.config.customCompute
//             : resolveAppCompute(this.config.computeProfile!);
//         const efs = this._createEfs();
//         const taskDefinitionName = `${this.name}-tsk-def`;
//         const taskDefinition = new aws.ecs.TaskDefinition(taskDefinitionName, {
//             cpu: cpu.toString(),
//             memory: memory.toString(),
//             executionRoleArn: this.createExecutionRole().arn,
//             taskRoleArn: this.createTaskRole(false, [efs.createReadWritePolicy()]).arn,
//             // taskRoleArn: this.createTaskRole().arn,
//             requiresCompatibilities: ["FARGATE"],
//             runtimePlatform: {
//                 operatingSystemFamily: "LINUX",
//                 cpuArchitecture: "X86_64"
//             },
//             networkMode: "awsvpc",
//             family: ecsTaskDefFam,
//             // proxyConfiguration: {
//             //     type: "APPMESH",
//             //     containerName: "envoy",
//             //     properties: {
//             //         "IgnoredUID": "1337",
//             //         "ProxyIngressPort": "15000",
//             //         "ProxyEgressPort": "15001",
//             //         "AppPorts": `${this._mongoPort}`,
//             //         "EgressIgnoredIPs": "169.254.170.2,169.254.169.254"
//             //     }
//             // },
//             volumes: this.createTaskVolumeConfiguration(false, [
//                 {
//                     name: "efs-vol",
//                     efsVolumeConfiguration: efs.createEfsVolumeConfigurationForEcsTaskDefinition()
//                 }
//             ]),
//             containerDefinitions: this.createContainerDefinitions(
//                 // virtualNode,
//                 {
//                 readonlyRootFilesystem: false,
//                 portMappings: [{
//                     hostPort: this._mongoPort,
//                     containerPort: this._mongoPort,
//                     protocol: "tcp"
//                 }],
//                 mountPoints: [{
//                     sourceVolume: "efs-vol",
//                     containerPath: "/data/db",
//                     readOnly: false
//                 }]
//             }),
//             tags: {
//                 ...NfraConfig.tags,
//                 Name: taskDefinitionName
//             }
//         },
//             // { dependsOn: virtualNode }
//         );
//         const cluster = this.createAppCluster();
//         const serviceSubnets = this.vpcDetails
//             .resolveSubnets([this.config.subnetNamePrefix])
//             .apply(t => t.map(u => u.id));
//         const containerLoadBalancerDetails = this.config.useNlb
//             ? this._createNlb(serviceSubnets) : undefined;
//         const serviceName = `${this.name}-svc`;
//         const _service = new aws.ecs.Service(serviceName, {
//             deploymentMinimumHealthyPercent: 0,
//             deploymentMaximumPercent: 100,
//             // os: "linux",
//             launchType: "FARGATE",
//             cluster: cluster.clusterArn,
//             taskDefinition: taskDefinition.arn,
//             networkConfiguration: {
//                 subnets: serviceSubnets,
//                 assignPublicIp: false,
//                 securityGroups: [secGroup.id]
//             },
//             serviceRegistries: {
//                 registryArn: sdService.arn
//             },
//             loadBalancers: containerLoadBalancerDetails
//                 ? [containerLoadBalancerDetails.containerLoadBalancer] : undefined,
//             desiredCount: this.config.minCapacity,
//             tags: {
//                 ...NfraConfig.tags,
//                 Name: serviceName
//             }
//         });
//         // NO AUTOSCALING
//         // this.configureAutoScaling(cluster, service);
//         return {
//             // taskRoleArn
//             host: `${this.name}.${this.vpcDetails.privateDnsDomain}`,
//             port: this._mongoPort,
//             username: this.config.username,
//             password: this.config.password,
//             nlbHost: containerLoadBalancerDetails?.host
//         };
//     }
//     private _createEfs(): EfsAccessPointDetails
//     {
//         const efsProvisioner = new EfsProvisioner(this.name, {
//             vpcDetails: this.vpcDetails,
//             subnetNamePrefix: this.config.subnetNamePrefix,
//             ingressSubnetNamePrefixes: [this.config.subnetNamePrefix]
//         });
//         const efsDetails = efsProvisioner.provision();
//         const accessPointDetails = efsDetails.provisionAccessPoint(
//             "/mongodbdata",
//             { uid: 999, gid: 999, permissions: 755 }
//         );
//         return accessPointDetails;
//     }
//     private _createNlb(serviceSubnets: Pulumi.Output<Array<string>>)
//         : ContainerLoadBalancerDetails
//     {
//         const nlbName = `${this.name}-nlb`;
//         const nlb = new awsx.lb.NetworkLoadBalancer(nlbName, {
//             vpc: this.vpcDetails.vpc,
//             subnets: serviceSubnets,
//             external: false,
//             tags: {
//                 ...NfraConfig.tags,
//                 Name: nlbName
//             }
//         });
//         const targetGroupName = `${this.name}-tgp`;
//         const targetGroup = nlb.createTargetGroup(targetGroupName, {
//             protocol: "TCP",
//             port: this._mongoPort,
//             targetType: "ip",
//             healthCheck: {
//                 interval: 30,
//                 healthyThreshold: 3,
//                 unhealthyThreshold: 3,
//                 protocol: "TCP",
//                 port: this._mongoPort.toString()
//             },
//             deregistrationDelay: 60,
//             tags: {
//                 ...NfraConfig.tags,
//                 Name: targetGroupName
//             }
//         });
//         const listenerName = `${this.name}-lnr`;
//         const listener = nlb.createListener(listenerName, {
//             protocol: "TCP",
//             port: this._mongoPort,
//             defaultActions: [{
//                 type: "forward",
//                 targetGroupArn: targetGroup.targetGroup.arn
//             }]
//         });
//         // const sdInstanceName = `${this.name}-sd-ins`;
//         // new SdInstance(sdInstanceName, {
//         //     instanceId: sdInstanceName,
//         //     serviceId: sdService.id,
//         //     attributes: {
//         //         AWS_ALIAS_DNS_NAME: alb.loadBalancer.dnsName,
//         //         AWS_INIT_HEALTH_STATUS: "HEALTHY"
//         //     }
//         // });
//         return {
//             host: listener.endpoint.hostname,
//             containerLoadBalancer: {
//                 targetGroupArn: targetGroup.targetGroup.arn,
//                 containerName: this.name,
//                 containerPort: this._mongoPort
//             }
//         };
//     }
// }
// type ContainerLoadBalancerDetails = {
//     host: Pulumi.Output<string>;
//     containerLoadBalancer: aws.types.input.ecs.ServiceLoadBalancer;
// };
//# sourceMappingURL=mongo-fargate-provisioner.js.map