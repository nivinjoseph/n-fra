"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemorydbProvisioner = void 0;
const n_defensive_1 = require("@nivinjoseph/n-defensive");
const memorydb_1 = require("@pulumi/aws/memorydb");
const Pulumi = require("@pulumi/pulumi");
const infra_config_1 = require("../../infra-config");
const ec2_1 = require("@pulumi/awsx/ec2");
const env_type_1 = require("../../env-type");
class MemorydbProvisioner {
    constructor(name, vpcInfo, config) {
        var _a;
        (0, n_defensive_1.given)(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
        (0, n_defensive_1.given)(vpcInfo, "vpcInfo").ensureHasValue().ensureIsObject();
        this._vpcInfo = vpcInfo;
        (0, n_defensive_1.given)(config, "config").ensureHasValue().ensureIsObject().ensureHasStructure({
            subnetNamePrefix: "string",
            ingressSubnetNamePrefixes: ["string"],
            nodeType: "string",
            "numShards?": "number"
        });
        (_a = config.numShards) !== null && _a !== void 0 ? _a : (config.numShards = 1);
        this._config = config;
    }
    provision() {
        const memorydbPort = 6379;
        const subnetGroupName = `${this._name}-subnet-grp`;
        const subnetGroup = new memorydb_1.SubnetGroup(subnetGroupName, {
            subnetIds: Pulumi.output(this._vpcInfo.vpc.getSubnets("isolated"))
                .apply((subnets) => subnets.where(t => t.subnetName.startsWith(this._config.subnetNamePrefix)).map(t => t.id)),
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: subnetGroupName })
        });
        const secGroupName = `${this._name}-sg`;
        const secGroup = new ec2_1.SecurityGroup(secGroupName, {
            vpc: this._vpcInfo.vpc,
            ingress: [{
                    protocol: "tcp",
                    fromPort: memorydbPort,
                    toPort: memorydbPort,
                    cidrBlocks: Pulumi.output(this._vpcInfo.vpc.getSubnets("private"))
                        .apply((subnets) => subnets.where(subnet => this._config.ingressSubnetNamePrefixes.some(prefix => subnet.subnetName.startsWith(prefix)))
                        .map(t => t.subnet.cidrBlock))
                }],
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: secGroupName })
        });
        const paramGroupName = `${this._name}-param-grp`;
        const paramGroup = new memorydb_1.ParameterGroup(paramGroupName, {
            family: "memorydb_redis6",
            parameters: [
                {
                    name: "activedefrag",
                    value: "yes"
                }, {
                    name: "maxmemory-policy",
                    value: "volatile-ttl"
                }
            ],
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: paramGroupName })
        });
        const isProd = infra_config_1.InfraConfig.env === env_type_1.EnvType.prod;
        const clusterName = `${this._name}-cluster`;
        const memdbCluster = new memorydb_1.Cluster("memdb-cluster", {
            nodeType: this._config.nodeType,
            engineVersion: "6.2",
            numShards: this._config.numShards,
            port: 6379,
            subnetGroupName: subnetGroup.name,
            securityGroupIds: [secGroup.id],
            snapshotWindow: "05:00-09:00",
            snapshotRetentionLimit: isProd ? 5 : 1,
            maintenanceWindow: "sun:02:00-sun:04:00",
            tlsEnabled: false,
            aclName: "open-access",
            autoMinorVersionUpgrade: true,
            numReplicasPerShard: isProd ? 3 : 1,
            parameterGroupName: paramGroup.name,
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: clusterName })
        });
        return {
            endpoints: memdbCluster.clusterEndpoints
                .apply(endpoints => endpoints.map(t => `${t.address}:${t.port}`).join(","))
        };
    }
}
exports.MemorydbProvisioner = MemorydbProvisioner;
//# sourceMappingURL=memorydb-provisioner.js.map