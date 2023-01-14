import { given } from "@nivinjoseph/n-defensive";
import { Aspv2Config } from "./aspv2-config";
import { Aspv2Details } from "./aspv2-details";
import * as Pulumi from "@pulumi/pulumi";
// import { SecurityGroup } from "@pulumi/awsx/ec2";
import * as awsx from "@pulumi/awsx";
import { NfraConfig } from "../../nfra-config";
// import { Cluster, ClusterInstance, EngineMode, EngineType, SubnetGroup, Proxy as RdsProxy, ProxyDefaultTargetGroup, ProxyTarget, ProxyEndpoint } from "@pulumi/aws/rds";
import * as aws from "@pulumi/aws";
// import { RandomPassword } from "@pulumi/random";
import * as random from "@pulumi/random";
import { VpcAz } from "../../vpc/vpc-az";
import { EnvType } from "../../env-type";
// import { Secret, SecretPolicy, SecretVersion } from "@pulumi/aws/secretsmanager";
// import { PolicyDocument, Role } from "@pulumi/aws/iam";


export class Aspv2Provisioner
{
    private readonly _name: string;
    private readonly _config: Aspv2Config;


    public constructor(name: string, config: Aspv2Config)
    {
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name;

        given(config, "config").ensureHasValue().ensureIsObject().ensureHasStructure({
            vpcDetails: "object",
            subnetNamePrefix: "string",
            ingressSubnetNamePrefixes: ["string"],
            databaseName: "string",
            minCapacity: "number",
            maxCapacity: "number",
            deletionProtection: "boolean",
            skipFinalSnapshot: "boolean"
        });
        this._config = config;
    }
    
    
    public provision(): Aspv2Details
    {
        const postgresDbPort = 5432;

        const dbSubnets = Pulumi.output(this._config.vpcDetails.vpc.getSubnets("isolated"))
            .apply((subnets) => subnets.where(t => t.subnetName.startsWith(this._config.subnetNamePrefix)));
            
        const subnetGroupName = `${this._name}-subnet-grp`;
        const subnetGroup = new aws.rds.SubnetGroup(subnetGroupName, {
            subnetIds: dbSubnets.apply((subnets) => subnets.map(t => t.id)),
            tags: {
                ...NfraConfig.tags,
                Name: subnetGroupName
            }
        });

        const proxySecGroupName = `${this._name}-proxy-sg`;
        const dbProxySecGroup = new aws.ec2.SecurityGroup(proxySecGroupName, {
            vpcId: this._config.vpcDetails.vpc.id,
            revokeRulesOnDelete: true,
            ingress: [{
                protocol: "tcp",
                fromPort: postgresDbPort,
                toPort: postgresDbPort,
                cidrBlocks: Pulumi.output(this._config.vpcDetails.vpc.getSubnets("private"))
                    .apply((subnets) =>
                        subnets.where(subnet =>
                            this._config.ingressSubnetNamePrefixes.some(prefix =>
                                subnet.subnetName.startsWith(prefix)))
                            .map(t => t.subnet.cidrBlock as Pulumi.Output<string>))
            }],
            egress: [{
                protocol: "tcp",
                fromPort: postgresDbPort,
                toPort: postgresDbPort,
                cidrBlocks: dbSubnets.apply((subnets) => subnets.map(t => t.subnet.cidrBlock as Pulumi.Output<string>))
            }],
            tags: {
                ...NfraConfig.tags,
                Name: proxySecGroupName
            }
        }, {
            replaceOnChanges: ["*"]
        });

        const dbSecGroupName = `${this._name}-db-sg`;
        const dbSecGroup = new awsx.ec2.SecurityGroup(dbSecGroupName, {
            vpc: this._config.vpcDetails.vpc,
            ingress: [{
                protocol: "tcp",
                fromPort: postgresDbPort,
                toPort: postgresDbPort,
                sourceSecurityGroupId: dbProxySecGroup.id
            }],
            tags: {
                ...NfraConfig.tags,
                Name: dbSecGroupName
            }
        });
        
        const dbPassword = new random.RandomPassword(`${this._name}-rpass`, {
            length: 16,
            special: true,
            overrideSpecial: `_`
        });

        const isProd = NfraConfig.env === EnvType.prod;
        
        const clusterName = `${this._name}-cluster`;
        const postgresDbCluster = new aws.rds.Cluster(clusterName, {
            availabilityZones: [
                NfraConfig.awsRegion + VpcAz.a,
                NfraConfig.awsRegion + VpcAz.b,
                NfraConfig.awsRegion + VpcAz.c
            ],
            engine: aws.rds.EngineType.AuroraPostgresql,
            engineMode: aws.rds.EngineMode.Provisioned,
            engineVersion: "13.7",
            dbSubnetGroupName: subnetGroup.name,
            vpcSecurityGroupIds: [dbSecGroup.id],
            databaseName: this._config.databaseName,
            masterUsername: "appuser",
            masterPassword: Pulumi.secret(dbPassword.result),
            port: postgresDbPort,
            storageEncrypted: true,
            // enabledCloudwatchLogsExports: ["postgresql"], // not supported by aurora serverless
            serverlessv2ScalingConfiguration: {
                minCapacity: this._config.minCapacity,
                maxCapacity: this._config.maxCapacity
            },
            enableHttpEndpoint: false,
            // preferredBackupWindow: "05:00-09:00", // You can't set the preferred backup window for an Aurora Serverless v1 DB cluster.
            backupRetentionPeriod: isProd ? 5 : 1,
            deletionProtection: this._config.deletionProtection, // to facilitate delete
            skipFinalSnapshot: this._config.skipFinalSnapshot, // to facilitate delete
            applyImmediately: true,
            tags: {
                ...NfraConfig.tags,
                Name: clusterName
            }
        });

        const numInstances = 3;
        const clusterInstances = new Array<aws.rds.ClusterInstance>();
        for (let i = 1; i <= numInstances; i++)
        {
            const clusterInstanceName = `${this._name}-clins-${i}`;
            clusterInstances.push(new aws.rds.ClusterInstance(clusterInstanceName, {
                clusterIdentifier: postgresDbCluster.id,
                instanceClass: "db.serverless",
                engine: aws.rds.EngineType.AuroraPostgresql,
                engineVersion: postgresDbCluster.engineVersion,
                publiclyAccessible: false,
                performanceInsightsEnabled: true,
                applyImmediately: true,
                tags: {
                    ...NfraConfig.tags,
                    Name: clusterInstanceName
                }
            }));
        }

        const dbCredsSecretName = `${this._name}-dbc-secret`;
        const dbCredsSecret = new aws.secretsmanager.Secret(dbCredsSecretName, {
            forceOverwriteReplicaSecret: true,
            tags: {
                ...NfraConfig.tags,
                Name: dbCredsSecretName
            }
        });

        new aws.secretsmanager.SecretVersion(`${dbCredsSecretName}-version`, {
            secretId: dbCredsSecret.id,
            secretString: Pulumi.interpolate`{"username": "${postgresDbCluster.masterUsername}", "password": "${postgresDbCluster.masterPassword}"}`
        });

        const assumeRolePolicyDocument: aws.iam.PolicyDocument = {
            Version: "2012-10-17",
            Statement: [
                {
                    Action: "sts:AssumeRole",
                    Effect: "Allow",
                    "Principal": {
                        "Service": "rds.amazonaws.com"
                    }
                }
            ]
        };

        const dbProxyRoleName = `${this._name}-dbp-role`;
        const dbProxyRole = new aws.iam.Role(dbProxyRoleName, {
            assumeRolePolicy: assumeRolePolicyDocument,
            tags: {
                ...NfraConfig.tags,
                Name: dbProxyRoleName
            }
        });

        new aws.secretsmanager.SecretPolicy(`${this._name}-dbc-secret-policy`, {
            secretArn: dbCredsSecret.arn,
            policy: Pulumi.all([dbProxyRole.arn, dbCredsSecret.arn]).apply(([roleArn, secretArn]) =>
            {
                return JSON.stringify(<aws.iam.PolicyDocument>{
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Sid": "EnableRdsProxyToReadTheSecret",
                            "Effect": "Allow",
                            "Principal": {
                                "AWS": roleArn
                            },
                            "Action": "secretsmanager:GetSecretValue",
                            "Resource": secretArn
                        }
                    ]
                });
            })
        });

        const dbProxyName = `${this._name}-dbp`;
        const dbProxy = new aws.rds.Proxy(dbProxyName, {
            debugLogging: false,
            engineFamily: "POSTGRESQL",
            idleClientTimeout: 1800,
            requireTls: false,
            roleArn: dbProxyRole.arn,
            vpcSecurityGroupIds: [dbProxySecGroup.id],
            vpcSubnetIds: dbSubnets.apply((subnets) => subnets.map(t => t.id)),
            auths: [{
                authScheme: "SECRETS",
                iamAuth: "DISABLED",
                secretArn: dbCredsSecret.arn
            }],
            tags: {
                ...NfraConfig.tags,
                Name: dbProxyName
            }
        }, { dependsOn: clusterInstances });

        const dbProxyDefaultTargetGroup = new aws.rds.ProxyDefaultTargetGroup(`${this._name}-dbp-dft-tgrp`, {
            dbProxyName: dbProxy.name,
            connectionPoolConfig: {
                connectionBorrowTimeout: 120,
                maxConnectionsPercent: 100,
                maxIdleConnectionsPercent: 50
            }
        });

        new aws.rds.ProxyTarget(`${this._name}-dbp-tg`, {
            dbClusterIdentifier: postgresDbCluster.id,
            dbProxyName: dbProxy.name,
            targetGroupName: dbProxyDefaultTargetGroup.name
        });

        const dbProxyReadonlyEndpointName = `${this._name}-dbp-roep`;
        const dbProxyReadonlyEndpoint = new aws.rds.ProxyEndpoint(dbProxyReadonlyEndpointName, {
            dbProxyName: dbProxy.name,
            dbProxyEndpointName: dbProxyReadonlyEndpointName,
            targetRole: "READ_ONLY",
            vpcSecurityGroupIds: [dbProxySecGroup.id],
            vpcSubnetIds: dbSubnets.apply((subnets) => subnets.map(t => t.id)),
            tags: {
                ...NfraConfig.tags,
                Name: dbProxyReadonlyEndpointName
            }
        });

        return {
            host: dbProxy.endpoint,
            port: Pulumi.output(postgresDbPort),
            databaseName: postgresDbCluster.databaseName,
            username: postgresDbCluster.masterUsername,
            password: postgresDbCluster.masterPassword as Pulumi.Output<string>,
            readerHost: dbProxyReadonlyEndpoint.endpoint
        };
    }
}