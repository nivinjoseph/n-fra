"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Aspv2Provisioner = void 0;
const n_defensive_1 = require("@nivinjoseph/n-defensive");
const Pulumi = require("@pulumi/pulumi");
const ec2_1 = require("@pulumi/awsx/ec2");
const infra_config_1 = require("../../infra-config");
const rds_1 = require("@pulumi/aws/rds");
const random_1 = require("@pulumi/random");
const vpc_az_1 = require("../../vpc/vpc-az");
const env_type_1 = require("../../env-type");
const secretsmanager_1 = require("@pulumi/aws/secretsmanager");
const iam_1 = require("@pulumi/aws/iam");
class Aspv2Provisioner {
    constructor(name, vpcInfo, config) {
        (0, n_defensive_1.given)(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
        (0, n_defensive_1.given)(vpcInfo, "vpcInfo").ensureHasValue().ensureIsObject();
        this._vpcInfo = vpcInfo;
        (0, n_defensive_1.given)(config, "config").ensureHasValue().ensureIsObject().ensureHasStructure({
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
    provision() {
        const postgresDbPort = 5432;
        const dbSubnets = Pulumi.output(this._vpcInfo.vpc.getSubnets("isolated"))
            .apply((subnets) => subnets.where(t => t.subnetName.startsWith(this._config.subnetNamePrefix)));
        const subnetGroupName = `${this._name}-subnet-grp`;
        const subnetGroup = new rds_1.SubnetGroup(subnetGroupName, {
            subnetIds: dbSubnets.apply((subnets) => subnets.map(t => t.id)),
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: subnetGroupName })
        });
        const proxySecGroupName = `${this._name}-proxy-sg`;
        const dbProxySecGroup = new ec2_1.SecurityGroup(proxySecGroupName, {
            vpc: this._vpcInfo.vpc,
            ingress: [{
                    protocol: "tcp",
                    fromPort: postgresDbPort,
                    toPort: postgresDbPort,
                    cidrBlocks: Pulumi.output(this._vpcInfo.vpc.getSubnets("private"))
                        .apply((subnets) => subnets.where(subnet => this._config.ingressSubnetNamePrefixes.some(prefix => subnet.subnetName.startsWith(prefix)))
                        .map(t => t.subnet.cidrBlock))
                }],
            egress: [{
                    protocol: "tcp",
                    fromPort: postgresDbPort,
                    toPort: postgresDbPort,
                    cidrBlocks: dbSubnets.apply((subnets) => subnets.map(t => t.subnet.cidrBlock))
                }],
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: proxySecGroupName })
        });
        const dbSecGroupName = `${this._name}-db-sg`;
        const dbSecGroup = new ec2_1.SecurityGroup(dbSecGroupName, {
            vpc: this._vpcInfo.vpc,
            ingress: [{
                    protocol: "tcp",
                    fromPort: postgresDbPort,
                    toPort: postgresDbPort,
                    sourceSecurityGroupId: dbProxySecGroup.id
                }],
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: dbSecGroupName })
        });
        const dbPassword = new random_1.RandomPassword(`${this._name}-rpass`, {
            length: 16,
            special: true,
            overrideSpecial: `_`
        });
        const isProd = infra_config_1.InfraConfig.env === env_type_1.EnvType.prod;
        const clusterName = `${this._name}-cluster`;
        const postgresDbCluster = new rds_1.Cluster(clusterName, {
            availabilityZones: [
                infra_config_1.InfraConfig.awsRegion + vpc_az_1.VpcAz.a,
                infra_config_1.InfraConfig.awsRegion + vpc_az_1.VpcAz.b,
                infra_config_1.InfraConfig.awsRegion + vpc_az_1.VpcAz.c
            ],
            engine: rds_1.EngineType.AuroraPostgresql,
            engineMode: rds_1.EngineMode.Provisioned,
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
            deletionProtection: this._config.deletionProtection,
            skipFinalSnapshot: this._config.skipFinalSnapshot,
            applyImmediately: true,
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: clusterName })
        });
        const numInstances = 3;
        const clusterInstances = new Array();
        for (let i = 1; i <= numInstances; i++) {
            const clusterInstanceName = `${this._name}-clins-${i}`;
            clusterInstances.push(new rds_1.ClusterInstance(clusterInstanceName, {
                clusterIdentifier: postgresDbCluster.id,
                instanceClass: "db.serverless",
                engine: rds_1.EngineType.AuroraPostgresql,
                engineVersion: postgresDbCluster.engineVersion,
                publiclyAccessible: false,
                performanceInsightsEnabled: true,
                applyImmediately: true,
                tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: clusterInstanceName })
            }));
        }
        const dbCredsSecretName = `${this._name}-dbc-secret`;
        const dbCredsSecret = new secretsmanager_1.Secret(dbCredsSecretName, {
            forceOverwriteReplicaSecret: true,
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: dbCredsSecretName })
        });
        new secretsmanager_1.SecretVersion(`${dbCredsSecretName}-version`, {
            secretId: dbCredsSecret.id,
            secretString: Pulumi.interpolate `{"username": "${postgresDbCluster.masterUsername}", "password": "${postgresDbCluster.masterPassword}"}`
        });
        const assumeRolePolicyDocument = {
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
        const dbProxyRole = new iam_1.Role(dbProxyRoleName, {
            assumeRolePolicy: assumeRolePolicyDocument,
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: dbProxyRoleName })
        });
        new secretsmanager_1.SecretPolicy(`${this._name}-dbc-secret-policy`, {
            secretArn: dbCredsSecret.arn,
            policy: Pulumi.all([dbProxyRole.arn, dbCredsSecret.arn]).apply(([roleArn, secretArn]) => {
                return JSON.stringify({
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
        const dbProxy = new rds_1.Proxy(dbProxyName, {
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
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: dbProxyName })
        }, { dependsOn: clusterInstances });
        const dbProxyDefaultTargetGroup = new rds_1.ProxyDefaultTargetGroup(`${this._name}-dbp-dft-tgrp`, {
            dbProxyName: dbProxy.name,
            connectionPoolConfig: {
                connectionBorrowTimeout: 120,
                maxConnectionsPercent: 100,
                maxIdleConnectionsPercent: 50
            }
        });
        new rds_1.ProxyTarget(`${this._name}-dbp-tg`, {
            dbClusterIdentifier: postgresDbCluster.id,
            dbProxyName: dbProxy.name,
            targetGroupName: dbProxyDefaultTargetGroup.name
        });
        const dbProxyReadonlyEndpointName = `${this._name}-dbp-roep`;
        const dbProxyReadonlyEndpoint = new rds_1.ProxyEndpoint(dbProxyReadonlyEndpointName, {
            dbProxyName: dbProxy.name,
            dbProxyEndpointName: dbProxyReadonlyEndpointName,
            targetRole: "READ_ONLY",
            vpcSecurityGroupIds: [dbProxySecGroup.id],
            vpcSubnetIds: dbSubnets.apply((subnets) => subnets.map(t => t.id)),
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: dbProxyReadonlyEndpointName })
        });
        return {
            host: dbProxy.endpoint,
            port: Pulumi.output(postgresDbPort),
            databaseName: postgresDbCluster.databaseName,
            username: postgresDbCluster.masterUsername,
            password: postgresDbCluster.masterPassword,
            readerHost: dbProxyReadonlyEndpoint.endpoint
        };
    }
}
exports.Aspv2Provisioner = Aspv2Provisioner;
//# sourceMappingURL=aspv2-provisioner.js.map