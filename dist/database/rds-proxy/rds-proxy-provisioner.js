import { ensureExhaustiveCheck, given } from "@nivinjoseph/n-defensive";
import { RdsProxyEngineFamily } from "./rds-proxy-config.js";
import * as aws from "@pulumi/aws";
import { NfraConfig } from "../../common/nfra-config.js";
import * as Pulumi from "@pulumi/pulumi";
import { SecurityGroupHelper } from "../../vpc/security-group-helper.js";
export class RdsProxyProvisioner {
    constructor(name, config) {
        // this._name = CommonHelper.prefixName(name);
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
        given(config, "config").ensureHasValue().ensureIsObject();
        this._config = config;
    }
    provision() {
        const dbCredsSecretName = `${this._name}-dbc-secret`;
        const dbCredsSecret = new aws.secretsmanager.Secret(dbCredsSecretName, {
            forceOverwriteReplicaSecret: true,
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: dbCredsSecretName })
        });
        new aws.secretsmanager.SecretVersion(`${dbCredsSecretName}-version`, {
            secretId: dbCredsSecret.id,
            secretString: Pulumi.interpolate `{"username": "${this._config.dbDetails.username}", "password": "${this._config.dbDetails.password}"}`
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
        const mariaDbPort = 3306;
        const postgresDbPort = 5432;
        let dbPort = 0;
        let dbEngineFamily = "";
        switch (this._config.engineFamily) {
            case RdsProxyEngineFamily.maria:
                dbPort = mariaDbPort;
                dbEngineFamily = "MYSQL";
                break;
            case RdsProxyEngineFamily.postgres:
                dbPort = postgresDbPort;
                dbEngineFamily = "POSTGRESQL";
                break;
            default:
                ensureExhaustiveCheck(this._config.engineFamily);
        }
        const ingressCidrBlocks = SecurityGroupHelper.resolveCidrBlocks(this._config.vpcDetails, this._config.ingressSubnetNamePrefixes);
        const egressCidrBlocks = SecurityGroupHelper.resolveCidrBlocks(this._config.vpcDetails, [this._config.dbSubnetNamePrefix]);
        const proxySecGroupName = `${this._name}-proxy-sg`;
        const dbProxySecGroup = new aws.ec2.SecurityGroup(proxySecGroupName, {
            vpcId: this._config.vpcDetails.vpc.id,
            revokeRulesOnDelete: true,
            ingress: [{
                    protocol: "tcp",
                    fromPort: dbPort,
                    toPort: dbPort,
                    cidrBlocks: ingressCidrBlocks
                }],
            egress: [{
                    protocol: "tcp",
                    fromPort: dbPort,
                    toPort: dbPort,
                    cidrBlocks: egressCidrBlocks
                }],
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: proxySecGroupName })
        }, {
        // replaceOnChanges: ["*"]
        });
        const serviceSubnets = this._config.vpcDetails
            .resolveSubnets([this._config.dbSubnetNamePrefix])
            .map(u => u.id);
        // .apply(t => t.map(u => u.id));
        const dbProxyName = `${this._name}-dbp`;
        const dbProxy = new aws.rds.Proxy(dbProxyName, {
            debugLogging: false,
            engineFamily: dbEngineFamily,
            idleClientTimeout: 1800,
            requireTls: false,
            roleArn: dbProxyRole.arn,
            vpcSecurityGroupIds: [dbProxySecGroup.id],
            vpcSubnetIds: serviceSubnets,
            auths: [{
                    authScheme: "SECRETS",
                    iamAuth: "DISABLED",
                    clientPasswordAuthType: this._config.engineFamily === RdsProxyEngineFamily.maria
                        ? "MYSQL_NATIVE_PASSWORD" : undefined,
                    secretArn: dbCredsSecret.arn
                }],
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: dbProxyName })
        });
        const dbProxyDefaultTargetGroup = new aws.rds.ProxyDefaultTargetGroup(`${this._name}-dbp-dft-tgp`, {
            dbProxyName: dbProxy.name,
            connectionPoolConfig: {
                connectionBorrowTimeout: 120,
                maxConnectionsPercent: 100,
                maxIdleConnectionsPercent: 50
            }
        });
        new aws.rds.ProxyTarget(`${this._name}-dbp-tg`, {
            dbInstanceIdentifier: this._config.dbDetails.instanceIdentifier,
            dbProxyName: dbProxy.name,
            targetGroupName: dbProxyDefaultTargetGroup.name
        });
        // const dbProxyReadonlyEndpointName = `${this._name}-dbp-roep`;
        // const dbProxyReadonlyEndpoint = new aws.rds.ProxyEndpoint(dbProxyReadonlyEndpointName, {
        //     dbProxyName: dbProxy.name,
        //     dbProxyEndpointName: dbProxyReadonlyEndpointName,
        //     targetRole: "READ_ONLY",
        //     vpcSecurityGroupIds: [dbProxySecGroup.id],
        //     vpcSubnetIds: serviceSubnets,
        //     tags: {
        //         ...NfraConfig.tags,
        //         Name: dbProxyReadonlyEndpointName
        //     }
        // });
        return {
            host: dbProxy.endpoint,
            port: dbPort,
            databaseName: this._config.dbDetails.databaseName,
            username: this._config.dbDetails.username,
            password: this._config.dbDetails.password
            // readerHost:  // dbProxyReadonlyEndpoint.endpoint
        };
    }
}
//# sourceMappingURL=rds-proxy-provisioner.js.map