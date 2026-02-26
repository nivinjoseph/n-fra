import { ensureExhaustiveCheck, given } from "@nivinjoseph/n-defensive";
import * as Pulumi from "@pulumi/pulumi";
import { NfraConfig } from "../../common/nfra-config.js";
// import { Cluster, ClusterInstance, EngineMode, EngineType, SubnetGroup, Proxy as RdsProxy, ProxyDefaultTargetGroup, ProxyTarget, ProxyEndpoint } from "@pulumi/aws/rds";
import * as aws from "@pulumi/aws";
// import { RandomPassword } from "@pulumi/random";
import * as Random from "@pulumi/random";
import { EnvType } from "../../common/env-type.js";
// import { Secret, SecretPolicy, SecretVersion } from "@pulumi/aws/secretsmanager";
// import { PolicyDocument, Role } from "@pulumi/aws/iam";
export class Aspv2Provisioner {
    constructor(name, config) {
        var _a, _b;
        // this._name = CommonHelper.prefixName(name);
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
        given(config, "config").ensureHasValue().ensureIsObject()
            .ensureHasStructure({
            vpcDetails: "object",
            subnetNamePrefix: "string",
            ingressSubnetNamePrefixes: ["string"],
            "engineVersion?": "number",
            "databaseName?": "string",
            "restoreSnapshotId?": "string",
            "username?": "string",
            "password?": "string",
            "numClusterInstances?": "number",
            minCapacity: "number",
            maxCapacity: "number",
            deletionProtection: "boolean",
            skipFinalSnapshot: "boolean"
        })
            .ensureWhen(config.engineVersion != null, (t) => [12, 13, 14, 15, 16, 17].contains(t.engineVersion), "engine version must be 12, 13, 14, 15, 16 or 17")
            .ensure(t => !(t.databaseName == null && t.restoreSnapshotId == null), "must provide one of databaseName or restoreSnapshotId")
            .ensure(t => !(t.databaseName != null && t.restoreSnapshotId != null), "must provide only one of databaseName or restoreSnapshotId")
            .ensureWhen(config.numClusterInstances != null, (t) => [1, 2, 3].contains(t.numClusterInstances), "num cluster instances must be 1, 2 or 3");
        (_a = config.engineVersion) !== null && _a !== void 0 ? _a : (config.engineVersion = 17);
        (_b = config.numClusterInstances) !== null && _b !== void 0 ? _b : (config.numClusterInstances = NfraConfig.env === EnvType.prod ? 3 : 1);
        this._config = config;
    }
    provision() {
        var _a, _b, _c, _d;
        const postgresDbPort = 5432;
        const dbSubnets = this._config.vpcDetails
            .resolveSubnets([this._config.subnetNamePrefix]);
        const subnetGroupName = `${this._name}-subnet-grp`;
        const subnetGroup = new aws.rds.SubnetGroup(subnetGroupName, {
            subnetIds: dbSubnets.map(t => t.id),
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: subnetGroupName })
        });
        const ingressCidrBlocks = this._config.vpcDetails
            .resolveSubnets(this._config.ingressSubnetNamePrefixes)
            .map(u => u.cidrBlock);
        // .apply(subnets => subnets.map(u => u.cidrBlock));
        const proxySecGroupName = `${this._name}-proxy-sg`;
        const dbProxySecGroup = new aws.ec2.SecurityGroup(proxySecGroupName, {
            vpcId: this._config.vpcDetails.vpc.id,
            revokeRulesOnDelete: true,
            ingress: [{
                    protocol: "tcp",
                    fromPort: postgresDbPort,
                    toPort: postgresDbPort,
                    cidrBlocks: ingressCidrBlocks
                }],
            egress: [{
                    protocol: "tcp",
                    fromPort: postgresDbPort,
                    toPort: postgresDbPort,
                    cidrBlocks: dbSubnets.map(t => t.cidrBlock)
                }],
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: proxySecGroupName })
        }, {
        // replaceOnChanges: ["*"]
        });
        const dbSecGroupName = `${this._name}-db-sg`;
        const dbSecGroup = new aws.ec2.SecurityGroup(dbSecGroupName, {
            // vpc: this._config.vpcDetails.vpc,
            vpcId: this._config.vpcDetails.vpc.id,
            revokeRulesOnDelete: true,
            ingress: [{
                    protocol: "tcp",
                    fromPort: postgresDbPort,
                    toPort: postgresDbPort,
                    securityGroups: [dbProxySecGroup.id]
                    // sourceSecurityGroupId: dbProxySecGroup.id
                }],
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: dbSecGroupName })
        });
        const username = (_a = this._config.username) !== null && _a !== void 0 ? _a : "appuser";
        const password = (_b = this._config.password) !== null && _b !== void 0 ? _b : this._createPassword();
        let engineVersion = "";
        let clusterParameterGroupName = "";
        let clusterParameterGroup;
        switch (this._config.engineVersion) {
            case 12:
                engineVersion = "12.22";
                clusterParameterGroupName = "default.aurora-postgresql12";
                break;
            case 13:
                engineVersion = "13.20";
                clusterParameterGroupName = "default.aurora-postgresql13";
                break;
            case 14:
                engineVersion = "14.17";
                clusterParameterGroupName = "default.aurora-postgresql14";
                break;
            case 15:
                {
                    engineVersion = "15.12";
                    const clusterParamGroupName = `${this._name}-postgres15-cls-param-grp`;
                    clusterParameterGroup = new aws.rds.ClusterParameterGroup(clusterParamGroupName, {
                        family: "aurora-postgresql15",
                        parameters: [{
                                name: "rds.force_ssl",
                                value: "0",
                                applyMethod: "immediate"
                            }],
                        tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: clusterParamGroupName })
                    });
                    clusterParameterGroupName = clusterParameterGroup.name;
                    break;
                }
            case 16:
                {
                    engineVersion = "16.8";
                    const clusterParamGroupName = `${this._name}-postgres16-cls-param-grp`;
                    clusterParameterGroup = new aws.rds.ClusterParameterGroup(clusterParamGroupName, {
                        family: "aurora-postgresql16",
                        parameters: [{
                                name: "rds.force_ssl",
                                value: "0",
                                applyMethod: "immediate"
                            }],
                        tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: clusterParamGroupName })
                    });
                    clusterParameterGroupName = clusterParameterGroup.name;
                    break;
                }
            case 17:
                {
                    engineVersion = "17.4";
                    const clusterParamGroupName = `${this._name}-postgres17-cls-param-grp`;
                    clusterParameterGroup = new aws.rds.ClusterParameterGroup(clusterParamGroupName, {
                        family: "aurora-postgresql17",
                        parameters: [{
                                name: "rds.force_ssl",
                                value: "0",
                                applyMethod: "immediate"
                            }],
                        tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: clusterParamGroupName })
                    });
                    clusterParameterGroupName = clusterParameterGroup.name;
                    break;
                }
            default:
                ensureExhaustiveCheck(this._config.engineVersion);
        }
        const isProd = NfraConfig.env === EnvType.prod;
        const clusterName = `${this._name}-cluster`;
        const postgresDbCluster = new aws.rds.Cluster(clusterName, {
            availabilityZones: NfraConfig.awsRegionAvailabilityZones,
            engine: aws.rds.EngineType.AuroraPostgresql,
            engineMode: aws.rds.EngineMode.Provisioned,
            engineVersion,
            dbClusterParameterGroupName: clusterParameterGroupName,
            dbInstanceParameterGroupName: clusterParameterGroupName,
            dbSubnetGroupName: subnetGroup.name,
            vpcSecurityGroupIds: [dbSecGroup.id],
            databaseName: (_c = this._config.databaseName) !== null && _c !== void 0 ? _c : undefined,
            snapshotIdentifier: (_d = this._config.restoreSnapshotId) !== null && _d !== void 0 ? _d : undefined,
            masterUsername: username,
            masterPassword: Pulumi.secret(password),
            port: postgresDbPort,
            storageEncrypted: true,
            allowMajorVersionUpgrade: true,
            // enabledCloudwatchLogsExports: ["postgresql"], // not supported by aurora serverless
            serverlessv2ScalingConfiguration: {
                minCapacity: this._config.minCapacity,
                maxCapacity: this._config.maxCapacity
            },
            enableHttpEndpoint: false,
            databaseInsightsMode: "standard", // advanced requires at least 465 days retention period
            performanceInsightsEnabled: true,
            performanceInsightsRetentionPeriod: 7,
            // preferredBackupWindow: "05:00-09:00", // You can't set the preferred backup window for an Aurora Serverless v1 DB cluster.
            backupRetentionPeriod: isProd ? 5 : 1,
            deletionProtection: this._config.deletionProtection, // to facilitate delete
            skipFinalSnapshot: this._config.skipFinalSnapshot, // to facilitate delete
            applyImmediately: true,
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: clusterName })
        }, {
            dependsOn: clusterParameterGroup != null ? clusterParameterGroup : undefined
        });
        const numInstances = this._config.numClusterInstances;
        const clusterInstances = new Array();
        for (let i = 1; i <= numInstances; i++) {
            const clusterInstanceName = `${this._name}-clins-${i}`;
            clusterInstances.push(new aws.rds.ClusterInstance(clusterInstanceName, {
                clusterIdentifier: postgresDbCluster.id,
                instanceClass: "db.serverless",
                engine: aws.rds.EngineType.AuroraPostgresql,
                engineVersion: postgresDbCluster.engineVersion,
                // dbParameterGroupName: clusterParameterGroupName,
                publiclyAccessible: false,
                performanceInsightsEnabled: true,
                performanceInsightsRetentionPeriod: 7,
                applyImmediately: true,
                tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: clusterInstanceName })
            }, {
                parent: postgresDbCluster
            }));
        }
        const dbCredsSecretName = `${this._name}-dbc-secret`;
        const dbCredsSecret = new aws.secretsmanager.Secret(dbCredsSecretName, {
            forceOverwriteReplicaSecret: true,
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: dbCredsSecretName })
        });
        new aws.secretsmanager.SecretVersion(`${dbCredsSecretName}-version`, {
            secretId: dbCredsSecret.id,
            secretString: Pulumi.interpolate `{"username": "${username}", "password": "${password}"}`
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
        const dbProxyRole = new aws.iam.Role(dbProxyRoleName, {
            assumeRolePolicy: assumeRolePolicyDocument,
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: dbProxyRoleName })
        });
        new aws.secretsmanager.SecretPolicy(`${this._name}-dbc-secret-policy`, {
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
        // TODO: DB proxy must be optional
        const dbProxyName = `${this._name}-dbp`;
        const dbProxy = new aws.rds.Proxy(dbProxyName, {
            debugLogging: false,
            engineFamily: "POSTGRESQL",
            idleClientTimeout: 1800,
            requireTls: false,
            roleArn: dbProxyRole.arn,
            vpcSecurityGroupIds: [dbProxySecGroup.id],
            vpcSubnetIds: dbSubnets.map(t => t.id),
            auths: [{
                    authScheme: "SECRETS",
                    iamAuth: "DISABLED",
                    secretArn: dbCredsSecret.arn
                }],
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: dbProxyName })
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
            vpcSubnetIds: dbSubnets.map(t => t.id),
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: dbProxyReadonlyEndpointName })
        });
        return {
            host: dbProxy.endpoint,
            port: postgresDbPort,
            databaseName: postgresDbCluster.databaseName,
            username: postgresDbCluster.masterUsername,
            password: postgresDbCluster.masterPassword,
            readerHost: dbProxyReadonlyEndpoint.endpoint
        };
    }
    _createPassword() {
        const password = new Random.RandomPassword(`${this._name}-rpass`, {
            length: 16,
            special: true,
            overrideSpecial: `_`
        });
        return password.result;
    }
}
//# sourceMappingURL=aspv2-provisioner.js.map