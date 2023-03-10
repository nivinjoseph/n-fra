"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemorydbProvisioner = void 0;
const n_defensive_1 = require("@nivinjoseph/n-defensive");
// import { Cluster, ParameterGroup, SubnetGroup } from "@pulumi/aws/memorydb";
const aws = require("@pulumi/aws");
const Pulumi = require("@pulumi/pulumi");
const nfra_config_1 = require("../../nfra-config");
// import { SecurityGroup } from "@pulumi/awsx/ec2";
const env_type_1 = require("../../env-type");
class MemorydbProvisioner {
    constructor(name, config) {
        var _a;
        (0, n_defensive_1.given)(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
        (0, n_defensive_1.given)(config, "config").ensureHasValue().ensureIsObject().ensureHasStructure({
            vpcDetails: "object",
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
        const subnetGroup = new aws.memorydb.SubnetGroup(subnetGroupName, {
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
                    fromPort: memorydbPort,
                    toPort: memorydbPort,
                    cidrBlocks: Pulumi.output(this._config.vpcDetails.vpc.getSubnets("private"))
                        .apply((subnets) => subnets.where(subnet => this._config.ingressSubnetNamePrefixes.some(prefix => subnet.subnetName.startsWith(prefix)))
                        .map(t => t.subnet.cidrBlock))
                }],
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: secGroupName })
        }, {
            replaceOnChanges: ["*"]
        });
        const paramGroupName = `${this._name}-param-grp`;
        const paramGroup = new aws.memorydb.ParameterGroup(paramGroupName, {
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
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: paramGroupName })
        });
        const isProd = nfra_config_1.NfraConfig.env === env_type_1.EnvType.prod;
        const clusterName = `${this._name}-cluster`;
        const memdbCluster = new aws.memorydb.Cluster("memdb-cluster", {
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
            numReplicasPerShard: isProd ? 2 : 0,
            parameterGroupName: paramGroup.name,
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: clusterName })
        });
        return {
            endpoints: memdbCluster.clusterEndpoints
                .apply(endpoints => endpoints.map(t => `${t.address}:${t.port}`).join(","))
        };
    }
}
exports.MemorydbProvisioner = MemorydbProvisioner;
//# sourceMappingURL=memorydb-provisioner.js.map