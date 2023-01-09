"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisProvisioner = void 0;
const n_defensive_1 = require("@nivinjoseph/n-defensive");
const elasticache_1 = require("@pulumi/aws/elasticache");
const Pulumi = require("@pulumi/pulumi");
const infra_config_1 = require("../../infra-config");
const ec2_1 = require("@pulumi/awsx/ec2");
const env_type_1 = require("../../env-type");
const vpc_az_1 = require("../../vpc/vpc-az");
class RedisProvisioner {
    constructor(name, vpcDetails, config) {
        (0, n_defensive_1.given)(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
        (0, n_defensive_1.given)(vpcDetails, "vpcDetails").ensureHasValue().ensureIsObject();
        this._vpcDetails = vpcDetails;
        (0, n_defensive_1.given)(config, "config").ensureHasValue().ensureIsObject().ensureHasStructure({
            subnetNamePrefix: "string",
            ingressSubnetNamePrefixes: ["string"],
            nodeType: "string"
        });
        this._config = config;
    }
    provision() {
        const redisPort = 6379;
        const subnetGroupName = `${this._name}-subnet-grp`;
        const subnetGroup = new elasticache_1.SubnetGroup(subnetGroupName, {
            subnetIds: Pulumi.output(this._vpcDetails.vpc.getSubnets("isolated"))
                .apply((subnets) => subnets.where(t => t.subnetName.startsWith(this._config.subnetNamePrefix)).map(t => t.id)),
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: subnetGroupName })
        });
        const secGroupName = `${this._name}-sg`;
        const secGroup = new ec2_1.SecurityGroup(secGroupName, {
            vpc: this._vpcDetails.vpc,
            ingress: [{
                    protocol: "tcp",
                    fromPort: redisPort,
                    toPort: redisPort,
                    cidrBlocks: Pulumi.output(this._vpcDetails.vpc.getSubnets("private"))
                        .apply((subnets) => subnets.where(subnet => this._config.ingressSubnetNamePrefixes.some(prefix => subnet.subnetName.startsWith(prefix)))
                        .map(t => t.subnet.cidrBlock))
                }],
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: secGroupName })
        });
        const paramGroupName = `${this._name}-param-grp`;
        const paramGroup = new elasticache_1.ParameterGroup(paramGroupName, {
            family: "redis6.x",
            parameters: [{
                    name: "maxmemory-policy",
                    value: "allkeys-lru"
                }],
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: paramGroupName })
        });
        const isProd = infra_config_1.InfraConfig.env === env_type_1.EnvType.prod;
        const replicationGroupName = `${this._name}-repli-grp`;
        const replicationGroup = new elasticache_1.ReplicationGroup(replicationGroupName, {
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
                infra_config_1.InfraConfig.awsRegion + vpc_az_1.VpcAz.a,
                infra_config_1.InfraConfig.awsRegion + vpc_az_1.VpcAz.b,
                infra_config_1.InfraConfig.awsRegion + vpc_az_1.VpcAz.c
            ] : [
                infra_config_1.InfraConfig.awsRegion + vpc_az_1.VpcAz.a
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
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: replicationGroupName })
        });
        return {
            host: replicationGroup.primaryEndpointAddress,
            port: redisPort
        };
    }
}
exports.RedisProvisioner = RedisProvisioner;
//# sourceMappingURL=redis-provisioner.js.map