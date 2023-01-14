"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisProvisioner = void 0;
const n_defensive_1 = require("@nivinjoseph/n-defensive");
// import { ParameterGroup, ReplicationGroup, SubnetGroup } from "@pulumi/aws/elasticache";
const aws = require("@pulumi/aws");
const Pulumi = require("@pulumi/pulumi");
const nfra_config_1 = require("../../nfra-config");
// import { SecurityGroup } from "@pulumi/awsx/ec2";
const env_type_1 = require("../../env-type");
const vpc_az_1 = require("../../vpc/vpc-az");
class RedisProvisioner {
    constructor(name, config) {
        (0, n_defensive_1.given)(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
        (0, n_defensive_1.given)(config, "config").ensureHasValue().ensureIsObject().ensureHasStructure({
            vpcDetails: "object",
            subnetNamePrefix: "string",
            ingressSubnetNamePrefixes: ["string"],
            nodeType: "string"
        });
        this._config = config;
    }
    provision() {
        const redisPort = 6379;
        const subnetGroupName = `${this._name}-subnet-grp`;
        const subnetGroup = new aws.elasticache.SubnetGroup(subnetGroupName, {
            subnetIds: Pulumi.output(this._config.vpcDetails.vpc.getSubnets("isolated"))
                .apply((subnets) => subnets.where(t => t.subnetName.startsWith(this._config.subnetNamePrefix)).map(t => t.id)),
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: subnetGroupName })
        });
        const secGroupName = `${this._name}-sg`;
        const secGroup = new aws.ec2.SecurityGroup(secGroupName, {
            vpcId: this._config.vpcDetails.vpc.id,
            revokeRulesOnDelete: true,
            ingress: [{
                    protocol: "tcp",
                    fromPort: redisPort,
                    toPort: redisPort,
                    cidrBlocks: Pulumi.output(this._config.vpcDetails.vpc.getSubnets("private"))
                        .apply((subnets) => subnets.where(subnet => this._config.ingressSubnetNamePrefixes.some(prefix => subnet.subnetName.startsWith(prefix)))
                        .map(t => t.subnet.cidrBlock))
                }],
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: secGroupName })
        }, {
            replaceOnChanges: ["*"]
        });
        const paramGroupName = `${this._name}-param-grp`;
        const paramGroup = new aws.elasticache.ParameterGroup(paramGroupName, {
            family: "redis6.x",
            parameters: [{
                    name: "maxmemory-policy",
                    value: "allkeys-lru"
                }],
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: paramGroupName })
        });
        const isProd = nfra_config_1.NfraConfig.env === env_type_1.EnvType.prod;
        const replicationGroupName = `${this._name}-repli-grp`;
        const replicationGroup = new aws.elasticache.ReplicationGroup(replicationGroupName, {
            replicationGroupDescription: `${this._name}-replication-group`,
            engine: "redis",
            engineVersion: "6.2",
            parameterGroupName: paramGroup.name,
            // parameterGroupName: "default.redis5.0.cluster.on",
            // parameterGroupName: "default.redis6.2",
            nodeType: this._config.nodeType,
            port: redisPort,
            numberCacheClusters: isProd ? 3 : 1,
            multiAzEnabled: isProd,
            availabilityZones: isProd ? [
                nfra_config_1.NfraConfig.awsRegion + vpc_az_1.VpcAz.a,
                nfra_config_1.NfraConfig.awsRegion + vpc_az_1.VpcAz.b,
                nfra_config_1.NfraConfig.awsRegion + vpc_az_1.VpcAz.c
            ] : [
                nfra_config_1.NfraConfig.awsRegion + vpc_az_1.VpcAz.a
            ],
            automaticFailoverEnabled: isProd,
            transitEncryptionEnabled: false,
            atRestEncryptionEnabled: true,
            // clusterMode: {
            //     numNodeGroups: 2,
            //     replicasPerNodeGroup: 1
            // },
            snapshotWindow: "05:00-09:00",
            snapshotRetentionLimit: 5,
            maintenanceWindow: "sun:02:00-sun:04:00",
            subnetGroupName: subnetGroup.name,
            securityGroupIds: [secGroup.id],
            applyImmediately: true,
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: replicationGroupName })
        });
        return {
            host: replicationGroup.primaryEndpointAddress,
            port: redisPort
        };
    }
}
exports.RedisProvisioner = RedisProvisioner;
//# sourceMappingURL=redis-provisioner.js.map