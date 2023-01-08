"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Aspv1Provisioner = void 0;
const n_defensive_1 = require("@nivinjoseph/n-defensive");
const rds_1 = require("@pulumi/aws/rds");
const Pulumi = require("@pulumi/pulumi");
const infra_config_1 = require("../../infra-config");
const ec2_1 = require("@pulumi/awsx/ec2");
const random_1 = require("@pulumi/random");
const vpc_az_1 = require("../../vpc/vpc-az");
const env_type_1 = require("../../env-type");
class Aspv1Provisioner {
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
            autoPause: "boolean",
            deletionProtection: "boolean",
            skipFinalSnapshot: "boolean"
        });
        this._config = config;
    }
    provision() {
        const postgresDbPort = 5432;
        const subnetGroupName = `${this._name}-subnet-grp`;
        const subnetGroup = new rds_1.SubnetGroup(subnetGroupName, {
            subnetIds: Pulumi.output(this._vpcInfo.vpc.getSubnets("isolated"))
                .apply((subnets) => subnets.where(t => t.subnetName.startsWith(this._config.subnetNamePrefix)).map(t => t.id)),
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: subnetGroupName })
        });
        const secGroupName = `${this._name}-sg`;
        const secGroup = new ec2_1.SecurityGroup(secGroupName, {
            vpc: this._vpcInfo.vpc,
            ingress: [{
                    protocol: "tcp",
                    fromPort: postgresDbPort,
                    toPort: postgresDbPort,
                    cidrBlocks: Pulumi.output(this._vpcInfo.vpc.getSubnets("private"))
                        .apply((subnets) => subnets.where(subnet => this._config.ingressSubnetNamePrefixes.some(prefix => subnet.subnetName.startsWith(prefix)))
                        .map(t => t.subnet.cidrBlock))
                }],
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: secGroupName })
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
            allowMajorVersionUpgrade: false,
            // engineVersion: "", // TODO: this needs to be configurable, not sure if this can be set for serverless v1
            engineMode: rds_1.EngineMode.Serverless,
            dbSubnetGroupName: subnetGroup.name,
            vpcSecurityGroupIds: [secGroup.id],
            databaseName: this._config.databaseName,
            masterUsername: "appuser",
            masterPassword: Pulumi.secret(dbPassword.result),
            port: postgresDbPort,
            storageEncrypted: true,
            // enabledCloudwatchLogsExports: ["postgresql"], // not supported by aurora serverless
            scalingConfiguration: {
                minCapacity: this._config.minCapacity,
                maxCapacity: this._config.maxCapacity,
                autoPause: this._config.autoPause
            },
            enableHttpEndpoint: false,
            // preferredBackupWindow: "05:00-09:00", // You can't set the preferred backup window for an Aurora Serverless v1 DB cluster.
            backupRetentionPeriod: isProd ? 5 : 1,
            // backupRetentionPeriod: 0, // to facilitate delete
            deletionProtection: this._config.deletionProtection,
            skipFinalSnapshot: this._config.skipFinalSnapshot,
            applyImmediately: true,
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: clusterName })
        });
        return {
            host: postgresDbCluster.endpoint,
            port: postgresDbCluster.port,
            databaseName: postgresDbCluster.databaseName,
            username: postgresDbCluster.masterUsername,
            password: postgresDbCluster.masterPassword,
            readerHost: postgresDbCluster.readerEndpoint
        };
    }
}
exports.Aspv1Provisioner = Aspv1Provisioner;
//# sourceMappingURL=aspv1-provisioner.js.map