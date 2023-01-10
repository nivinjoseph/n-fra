"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Aspv1Provisioner = void 0;
const n_defensive_1 = require("@nivinjoseph/n-defensive");
// import { Cluster, EngineMode, EngineType, SubnetGroup } from "@pulumi/aws/rds";
const aws = require("@pulumi/aws");
const Pulumi = require("@pulumi/pulumi");
const infra_config_1 = require("../../infra-config");
// import { SecurityGroup } from "@pulumi/awsx/ec2";
// import { RandomPassword } from "@pulumi/random";
const random = require("@pulumi/random");
const vpc_az_1 = require("../../vpc/vpc-az");
const env_type_1 = require("../../env-type");
class Aspv1Provisioner {
    constructor(name, vpcDetails, config) {
        (0, n_defensive_1.given)(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
        (0, n_defensive_1.given)(vpcDetails, "vpcDetails").ensureHasValue().ensureIsObject();
        this._vpcDetails = vpcDetails;
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
        const subnetGroup = new aws.rds.SubnetGroup(subnetGroupName, {
            subnetIds: Pulumi.output(this._vpcDetails.vpc.getSubnets("isolated"))
                .apply((subnets) => subnets.where(t => t.subnetName.startsWith(this._config.subnetNamePrefix)).map(t => t.id)),
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: subnetGroupName })
        });
        const secGroupName = `${this._name}-sg`;
        const secGroup = new aws.ec2.SecurityGroup(secGroupName, {
            vpcId: this._vpcDetails.vpc.id,
            revokeRulesOnDelete: true,
            ingress: [{
                    protocol: "tcp",
                    fromPort: postgresDbPort,
                    toPort: postgresDbPort,
                    self: true,
                    cidrBlocks: Pulumi.output(this._vpcDetails.vpc.getSubnets("private"))
                        .apply((subnets) => subnets.where(subnet => this._config.ingressSubnetNamePrefixes.some(prefix => subnet.subnetName.startsWith(prefix)))
                        .map(t => t.subnet.cidrBlock))
                }],
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: secGroupName })
        }, {
            replaceOnChanges: ["*"]
        });
        const dbPassword = new random.RandomPassword(`${this._name}-rpass`, {
            length: 16,
            special: true,
            overrideSpecial: `_`
        });
        const isProd = infra_config_1.InfraConfig.env === env_type_1.EnvType.prod;
        const clusterName = `${this._name}-cluster`;
        const postgresDbCluster = new aws.rds.Cluster(clusterName, {
            availabilityZones: [
                infra_config_1.InfraConfig.awsRegion + vpc_az_1.VpcAz.a,
                infra_config_1.InfraConfig.awsRegion + vpc_az_1.VpcAz.b,
                infra_config_1.InfraConfig.awsRegion + vpc_az_1.VpcAz.c
            ],
            engine: aws.rds.EngineType.AuroraPostgresql,
            allowMajorVersionUpgrade: false,
            // engineVersion: "", // TODO: this needs to be configurable, not sure if this can be set for serverless v1
            engineMode: aws.rds.EngineMode.Serverless,
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