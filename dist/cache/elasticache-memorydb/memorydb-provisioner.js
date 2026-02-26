import { given } from "@nivinjoseph/n-defensive";
// import { Cluster, ParameterGroup, SubnetGroup } from "@pulumi/aws/memorydb";
import * as aws from "@pulumi/aws";
import { NfraConfig } from "../../common/nfra-config.js";
import { EnvType } from "../../common/env-type.js";
export class MemorydbProvisioner {
    constructor(name, config) {
        var _a;
        // this._name = CommonHelper.prefixName(name);
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
        given(config, "config").ensureHasValue().ensureIsObject().ensureHasStructure({
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
        const cacheSubnets = this._config.vpcDetails
            .resolveSubnets([this._config.subnetNamePrefix]);
        const subnetGroupName = `${this._name}-memdb-subnet-grp`;
        const subnetGroup = new aws.memorydb.SubnetGroup(subnetGroupName, {
            subnetIds: cacheSubnets.map(t => t.id),
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: subnetGroupName })
        });
        const ingressCidrBlocks = this._config.vpcDetails
            .resolveSubnets(this._config.ingressSubnetNamePrefixes)
            .map(u => u.cidrBlock);
        // .apply(subnets => subnets.map(u => u.cidrBlock));
        const secGroupName = `${this._name}-memdb-sg`;
        const secGroup = new aws.ec2.SecurityGroup(secGroupName, {
            vpcId: this._config.vpcDetails.vpc.id,
            revokeRulesOnDelete: true,
            ingress: [{
                    protocol: "tcp",
                    fromPort: memorydbPort,
                    toPort: memorydbPort,
                    cidrBlocks: ingressCidrBlocks
                }],
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: secGroupName })
        }, {
        // replaceOnChanges: ["*"]
        });
        const paramGroupName = `${this._name}-memdb-param-grp`;
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
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: paramGroupName })
        });
        const isProd = NfraConfig.env === EnvType.prod;
        const clusterName = `${this._name}-memdb-cluster`;
        const memdbCluster = new aws.memorydb.Cluster(clusterName, {
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
            numReplicasPerShard: isProd ? 1 : 0,
            parameterGroupName: paramGroup.name,
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: clusterName })
        });
        return {
            endpoints: memdbCluster.clusterEndpoints
                .apply(endpoints => endpoints.map(t => `${t.address}:${t.port}`).join(","))
        };
    }
}
//# sourceMappingURL=memorydb-provisioner.js.map