// import { ensureExhaustiveCheck, given } from "@nivinjoseph/n-defensive";
// import * as Pulumi from "@pulumi/pulumi";
// import { NfraConfig } from "../../common/nfra-config.js";
// import { AppProvisioner } from "../app-provisioner.js";
// import * as aws from "@pulumi/aws";
// import { ServiceAppConfig, ServiceAppComputeProfile } from "./service-app-config.js";
// import { ServiceAppDetails } from "./service-app-details.js";
// import { AppClusterDetails } from "../app-cluster-details.js";
// import { PolicyDocument } from "../../security/policy/policy-document.js";


// export class ServiceAppProvisioner extends AppProvisioner<ServiceAppConfig | any, ServiceAppDetails>
// {
//     public constructor(name: string, config: ServiceAppConfig)
//     {
//         given(config, "config").ensureHasValue().ensureIsObject();
//         config.computeProfile ??= ServiceAppComputeProfile.large;
//         config.volumeSize ??= 250;
        
//         super(name, config);

//         given(config, "config").ensureHasStructure({
//             ingressSubnetNamePrefixes: ["string"],
//             port: "number",
//             "volumes?": [{
//                 name: "string",
//                 "hostPath?": "string"
//             }],
//             "mountPoints?": [{
//                 sourceVolume: "string",
//                 containerPath: "string"
//             }],
//             volumeSize: "number"
//         });
//     }

//     protected override provisionApp(): ServiceAppDetails
//     {
//         const config = this.config as ServiceAppConfig;
        
//         const servicePort = config.port;
        
//         const ingressCidrBlocks = this.vpcDetails
//             .resolveSubnets(this.config.ingressSubnetNamePrefixes)
//             .map(u => u.cidrBlock);
//             // .apply(subnets => subnets.map(u => u.cidrBlock));
        
//         const secGroupName = `${this.name}-app-sg`;
//         const secGroup = new aws.ec2.SecurityGroup(secGroupName, {
//             vpcId: this.vpcDetails.vpc.id,
//             revokeRulesOnDelete: true,
//             ingress: [
//                 { // FIXME:// more ports here
//                     protocol: "tcp",
//                     fromPort: servicePort,
//                     toPort: servicePort,
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
//                 Name: sdServiceName,
//                 ...this.config.tags ?? {}
//             }
//         }, { dependsOn: this.vpcDetails.privateDnsNamespace });

//         // const sdInstanceName = `${this.name}-sd-ins`;
//         // new SdInstance(sdInstanceName, {
//         //     instanceId: sdInstanceName,
//         //     serviceId: sdService.id,
//         //     attributes: {
//         //         AWS_ALIAS_DNS_NAME: alb.loadBalancer.dnsName,
//         //         AWS_INIT_HEALTH_STATUS: "HEALTHY"
//         //     }
//         // });

//         const ecsTaskDefFam = `${this.name}-tsk-def-fam`;

//         // const virtualNodeName = `${this.name}-vnode`;
//         // const virtualNode = new aws.appmesh.VirtualNode(virtualNodeName, {
//         //     name: virtualNodeName,
//         //     meshName: this.vpcDetails.serviceMesh.name,
//         //     spec: {
//         //         listeners: [{
//         //             portMapping: {
//         //                 port: servicePort,
//         //                 protocol: "tcp"
//         //             },
//         //             healthCheck: {
//         //                 healthyThreshold: 3,
//         //                 intervalMillis: 10000,
//         //                 port: servicePort,
//         //                 protocol: "tcp",
//         //                 timeoutMillis: 5000,
//         //                 unhealthyThreshold: 3
//         //             }
//         //         }],
//         //         // logging: { // TODO: turn off access log
//         //         //     accessLog: {
//         //         //         file: {
//         //         //             path: "/dev/stdout",
//         //         //         }
//         //         //     }
//         //         // },
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
//         //         Name: virtualNodeName,
//         //         ...this.config.tags ?? {}
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
//         //         Name: virtualServiceName,
//         //         ...this.config.tags ?? {}
//         //     }
//         // }, { dependsOn: [this.vpcDetails.serviceMesh, this.vpcDetails.privateDnsNamespace, virtualNode] });


//         const taskDefinitionName = `${this.name}-tsk-def`;
//         const taskDefinition = new aws.ecs.TaskDefinition(taskDefinitionName, {
//             executionRoleArn: this.createExecutionRole(this._createTaskExecutionRolePolicies()).arn,
//             taskRoleArn: this.createTaskRole(true).arn,
//             requiresCompatibilities: ["EC2"],
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
//             //         "AppPorts": `${servicePort}`, // FIXME: more ports
//             //         "EgressIgnoredIPs": "169.254.170.2,169.254.169.254"
//             //     }
//             // },
//             volumes: this.createTaskVolumeConfiguration(true,config.taskVolumes),
//             containerDefinitions: this.createContainerDefinitions(
//                 // virtualNode,
//                 {
//                 memoryReservation: 2048,
//                 cpu: 1500,
//                 // FIXME: need additional port mappings
//                 portMappings: [{
//                     hostPort: servicePort,
//                     containerPort: servicePort,
//                     protocol: "tcp"
//                 }],
//                 mountPoints: config.containerMountPoints?.map(t => ({
//                     ...t,
//                     readOnly: false
//                 })) ?? []
//             }, true),
//             tags: {
//                 ...NfraConfig.tags,
//                 Name: taskDefinitionName,
//                 ...this.config.tags ?? {}
//             }
//         }
//             // { dependsOn: virtualNode }
//         );

//         const serviceSubnets = this.vpcDetails
//             .resolveSubnets([this.config.subnetNamePrefix])
//             .map(u => u.id);
//             // .apply(t => t.map(u => u.id));
        
//         const cluster = this._createCluster(secGroup, serviceSubnets);

//         const serviceName = `${this.name}-svc`;
//         new aws.ecs.Service(serviceName, {
//             deploymentMinimumHealthyPercent: 0,
//             deploymentMaximumPercent: 100,
//             // healthCheckGracePeriodSeconds: 300, // not valid because we are not using NLB
//             // os: "linux",
//             launchType: "EC2",
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
//             desiredCount: 1,
//             orderedPlacementStrategies: [{
//                 type: "binpack",
//                 field: "cpu"
//             }],
//             placementConstraints: [{
//                 type: "memberOf",
//                 expression: `attribute:ecs.availability-zone in [${NfraConfig.awsRegionAvailabilityZones.takeFirst()}]`
//             }],
//             forceNewDeployment: true,
//             propagateTags: "TASK_DEFINITION",
//             tags: {
//                 ...NfraConfig.tags,
//                 Name: serviceName,
//                 ...this.config.tags ?? {}
//             }
//         });

//         // this.configureAutoScaling(cluster, service);

//         return {
//             // taskRoleArn
//             host: `${this.name}.${this.vpcDetails.privateDnsDomain}`,
//             port: servicePort
//         };
//     }
    
//     private _createCluster(securityGroup: aws.ec2.SecurityGroup, serviceSubnets: Array<Pulumi.Output<string>>): AppClusterDetails
//     {
//         const config = this.config as ServiceAppConfig;        
        
//         const instanceArchitecture = "x86_64";
//         const ec2Ami = Pulumi.output(aws.ec2.getAmi({
//             mostRecent: true,
//             owners: ["amazon"],
//             filters: [
//                 {
//                     name: "name",
//                     values: [`amzn2-ami-ecs-hvm-*-${instanceArchitecture}-ebs`]
//                 },
//                 {
//                     name: "architecture",
//                     values: [instanceArchitecture]
//                 },
//                 {
//                     name: "root-device-type",
//                     values: ["ebs"]
//                 }]
//         }));

//         const ebsVolumeName = `${this.name}-ebs-vol`;
//         const ebsVolume = new aws.ebs.Volume(ebsVolumeName, {
//             availabilityZone: NfraConfig.awsRegionAvailabilityZones.takeFirst(),
//             size: config.volumeSize,
//             type: "gp2",
//             encrypted: true,
//             tags: {
//                 ...NfraConfig.tags,
//                 Name: ebsVolumeName
//             }
//         });

//         const clusterName = `${this.name}-cls`;
        
//         const launchTemplateName = `${this.name}-lt`;
//         const launchTemplate = new aws.ec2.LaunchTemplate(launchTemplateName, {
//             imageId: ec2Ami.id,
//             instanceType: this._resolveEc2InstanceType(config.computeProfile!),
//             iamInstanceProfile: { arn: this._createEc2InstanceProfile().arn },
//             networkInterfaces: [{
//                 associatePublicIpAddress: "false",
//                 securityGroups: [securityGroup.id]
//             }],
//             ebsOptimized: "true",
//             metadataOptions: {
//                 httpEndpoint: "enabled",
//                 httpTokens: "required"
//             },
//             blockDeviceMappings: [{
//                 deviceName: "/dev/xvda",
//                 ebs: {
//                     volumeSize: 60,
//                     volumeType: "gp2",
//                     encrypted: "true",
//                     deleteOnTermination: "true"
//                 }
//             }],
//             userData: config.userDataFunc != null
//                 ? config.userDataFunc({
//                     clusterName: Pulumi.output(clusterName),
//                     ebsVolumeId: ebsVolume.id
//                 }).apply(t => Buffer.from(t, "binary").toString("base64"))
//                 : undefined,
//             tags: {
//                 ...NfraConfig.tags,
//                 Name: launchTemplateName
//             }
//         }, {
//             dependsOn: [ebsVolume]
//         });

//         const asgName = `${this.name}-asg`;
//         const asgSize = config.isOn ? 1 : 0;
//         const autoscalingGroupArgs: aws.autoscaling.GroupArgs = {
//             minSize: asgSize,
//             maxSize: asgSize,
//             desiredCapacity: asgSize,
//             // healthCheckType: "EC2",
//             // healthCheckGracePeriod: 300,
//             vpcZoneIdentifiers: serviceSubnets,
//             launchTemplate: {
//                 id: launchTemplate.id,
//                 version: "$Latest"
//             },
//             tags: [
//                 {
//                     key: "AmazonECSManaged",
//                     value: "true",
//                     propagateAtLaunch: true
//                 },
//                 {
//                     key: "Name",
//                     value: asgName,
//                     propagateAtLaunch: true
//                 },
//                 {
//                     key: "ECS_CLUSTER",
//                     value: clusterName,
//                     propagateAtLaunch: true
//                 },
//                 ...Object.entries(NfraConfig.tags)
//                     .map(t => ({ key: t[0], value: t[1], propagateAtLaunch: true }))
//             ]
//         };
//         const autoscalingGroup = new aws.autoscaling.Group(asgName, autoscalingGroupArgs);
        
//         const capacityProviderName = `${this.name}-cp`;
//         const capacityProvider = new aws.ecs.CapacityProvider(capacityProviderName, {
//             autoScalingGroupProvider: {
//                 autoScalingGroupArn: autoscalingGroup.arn,
//                 managedTerminationProtection: "DISABLED",
//                 managedScaling: {
//                     status: "DISABLED"
//                 }
//             },
//             tags: {
//                 Name: capacityProviderName,
//                 ...NfraConfig.tags
//             }
//         });

//         const cluster = new aws.ecs.Cluster(clusterName, {
//             // capacityProviders: [capacityProvider.name],
//             settings: [
//                 {
//                     name: "containerInsights",
//                     value: config.clusterConfig?.enableContainerInsights ? "enabled" : "disabled"
//                 }
//             ],
//             tags: {
//                 Name: clusterName,
//                 ...NfraConfig.tags
//             }
//         });
        
//         const clusterCapacityProviderName = `${this.name}-cls-cp`;
//         new aws.ecs.ClusterCapacityProviders(clusterCapacityProviderName, {
//             clusterName: cluster.name,
//             capacityProviders: [capacityProvider.name],
//             defaultCapacityProviderStrategies: [{
//                 capacityProvider: capacityProvider.name,
//                 base: 1,
//                 weight: 100
//             }]
//         });
        
//         return {
//             clusterName: cluster.name,
//             clusterArn: cluster.arn,
//             usesSpotInstances: false
//         };
//     }
    
//     private _resolveEc2InstanceType(computeProfile: ServiceAppComputeProfile): string
//     {
//         given(computeProfile, "computeProfile").ensureHasValue()
//             .ensureIsEnum(ServiceAppComputeProfile);
        
//         switch (computeProfile)
//         {
//             case ServiceAppComputeProfile.large:
//                 return "c5.large";
//             case ServiceAppComputeProfile.xlarge:
//                 return "c5.xlarge";
//             case ServiceAppComputeProfile.xxlarge:
//                 return "c5.2xlarge";
//             case ServiceAppComputeProfile.xxxlarge:
//                 return "c5.4xlarge";
//             default:
//                 ensureExhaustiveCheck(computeProfile);
//         }
//     }
    
//     private _createEc2InstanceProfile(): aws.iam.InstanceProfile
//     {
//         const assumeRolePolicyDocument: aws.iam.PolicyDocument = {
//             Version: "2012-10-17",
//             Statement: [
//                 {
//                     Action: "sts:AssumeRole",
//                     Effect: "Allow",
//                     "Principal": {
//                         "Service": "ec2.amazonaws.com"
//                     }
//                 }
//             ]
//         };
        
//         const ebsPolicyDocument: aws.iam.PolicyDocument = {
//             Version: "2012-10-17",
//             Statement: [
//                 {
//                     Action: [
//                         "ecs:CreateCluster",
//                         "ecs:DeregisterContainerInstance",
//                         "ecs:DiscoverPollEndpoint",
//                         "ecs:Poll",
//                         "ecs:RegisterContainerInstance",
//                         "ecs:StartTelemetrySession",
//                         "ecs:Submit*",

//                         "ecr:GetAuthorizationToken",
//                         "ecr:BatchCheckLayerAvailability",
//                         "ecr:GetDownloadUrlForLayer",
//                         "ecr:BatchGetImage",
//                         "logs:CreateLogStream",
//                         "logs:PutLogEvents",

//                         "ec2:AttachVolume",
//                         "ec2:CreateVolume",
//                         "ec2:CreateSnapshot",
//                         "ec2:CreateTags",
//                         "ec2:DeleteVolume",
//                         "ec2:DeleteSnapshot",
//                         "ec2:DescribeAvailabilityZones",
//                         "ec2:DescribeInstances",
//                         "ec2:DescribeVolumes",
//                         "ec2:DescribeVolumeAttribute",
//                         "ec2:DescribeVolumeStatus",
//                         "ec2:DescribeSnapshots",
//                         "ec2:CopySnapshot",
//                         "ec2:DescribeSnapshotAttribute",
//                         "ec2:DetachVolume",
//                         "ec2:ModifySnapshotAttribute",
//                         "ec2:ModifyVolumeAttribute",
//                         "ec2:DescribeTags",

//                         "ec2:AuthorizeSecurityGroupIngress",
//                         "ec2:Describe*",
//                         "elasticloadbalancing:DeregisterInstancesFromLoadBalancer",
//                         "elasticloadbalancing:Describe*",
//                         "elasticloadbalancing:RegisterInstancesWithLoadBalancer",
//                         "elasticloadbalancing:DeregisterTargets",
//                         "elasticloadbalancing:DescribeTargetGroups",
//                         "elasticloadbalancing:DescribeTargetHealth",
//                         "elasticloadbalancing:RegisterTargets"
//                     ],
//                     Resource: "*",
//                     Effect: "Allow"
//                 }
//             ]
//         };

        
//         const ec2RoleName = `${this.name}-ec2-rle`;
//         const ec2Role = new aws.iam.Role(ec2RoleName, {
//             assumeRolePolicy: assumeRolePolicyDocument,
//             managedPolicyArns: [
//                 "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role",
//                 "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
//                 "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceRole"
//             ],
//             inlinePolicies: [{
//                 name: "ebs_policy",
//                 policy : JSON.stringify(ebsPolicyDocument)
//             }],
//             forceDetachPolicies: true,
//             tags: {
//                 ...NfraConfig.tags,
//                 Name: ec2RoleName
//             }
//         });

//         const instanceProfileName = `${this.name}-ec2-iam-ip`;
//         const ec2InstanceProfile = new aws.iam.InstanceProfile(instanceProfileName, {
//             role: ec2Role,
//             tags: {
//                 ...NfraConfig.tags,
//                 Name: instanceProfileName
//             }
//         });

//         return ec2InstanceProfile;
//     }
    
//     private _createTaskExecutionRolePolicies(): Array<PolicyDocument | string>
//     {
//         return [
//             "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role",
//             "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
//             "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceRole",
//             {
//                 Version: "2012-10-17",
//                 Statement: [
//                     {
//                         Action: [
//                             "ecs:CreateCluster",
//                             "ecs:DeregisterContainerInstance",
//                             "ecs:DiscoverPollEndpoint",
//                             "ecs:Poll",
//                             "ecs:RegisterContainerInstance",
//                             "ecs:StartTelemetrySession",
//                             "ecs:Submit*",
//                             "ecs:ListTagsForResource",
//                             "ecs:ListClusters",
//                             "ecs:ListContainerInstances",
//                             "ecs:DescribeContainerInstances",
//                             "ecs:ListServices",

//                             "ecr:GetAuthorizationToken",
//                             "ecr:BatchCheckLayerAvailability",
//                             "ecr:GetDownloadUrlForLayer",
//                             "ecr:BatchGetImage",
//                             "logs:CreateLogStream",
//                             "logs:PutLogEvents",

//                             "ec2:AttachVolume",
//                             "ec2:CreateVolume",
//                             "ec2:CreateSnapshot",
//                             "ec2:CreateTags",
//                             "ec2:DeleteVolume",
//                             "ec2:DeleteSnapshot",
//                             "ec2:DescribeAvailabilityZones",
//                             "ec2:DescribeInstances",
//                             "ec2:DescribeVolumes",
//                             "ec2:DescribeVolumeAttribute",
//                             "ec2:DescribeVolumeStatus",
//                             "ec2:DescribeSnapshots",
//                             "ec2:CopySnapshot",
//                             "ec2:DescribeSnapshotAttribute",
//                             "ec2:DetachVolume",
//                             "ec2:ModifySnapshotAttribute",
//                             "ec2:ModifyVolumeAttribute",
//                             "ec2:DescribeTags",

//                             "ec2:AuthorizeSecurityGroupIngress",
//                             "ec2:Describe*",
//                             "elasticloadbalancing:DeregisterInstancesFromLoadBalancer",
//                             "elasticloadbalancing:Describe*",
//                             "elasticloadbalancing:RegisterInstancesWithLoadBalancer",
//                             "elasticloadbalancing:DeregisterTargets",
//                             "elasticloadbalancing:DescribeTargetGroups",
//                             "elasticloadbalancing:DescribeTargetHealth",
//                             "elasticloadbalancing:RegisterTargets"
//                         ],
//                         Resource: "*",
//                         Effect: "Allow"
//                     }
//                 ]
//             }
//         ];
//     }
// }