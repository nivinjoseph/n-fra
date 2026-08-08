import { given } from "@nivinjoseph/n-defensive";
import * as aws from "@pulumi/aws";
import * as Pulumi from "@pulumi/pulumi";
import { NfraConfig } from "../../common/nfra-config.js";
import { EnvType } from "../../common/env-type.js";
import { ValkeyEvictionPolicy } from "./valkey-eviction-policy.js";
export class ValkeyProvisioner {
    static _engineVersion = "9.1";
    static _paramGroupFamily = "valkey9";
    /**
     * @description A replication group is capped at 6 cache clusters (1 primary plus 5 replicas),
     * and replicas per node group is capped at 5.
     */
    static _maxReplicasPerShard = 5;
    /**
     * @description Node type families that support durability.
     * https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Durability.Limitations.html
     */
    static _durableNodeTypeFamilies = ["r8g", "r7g", "r6g", "m8g", "m7g", "m6g", "c8gn", "c7gn"];
    _name;
    _config;
    constructor(name, config) {
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
        given(config, "config").ensureHasValue().ensureIsObject().ensureHasStructure({
            vpcDetails: "object",
            subnetNamePrefix: "string",
            ingressSubnetNamePrefixes: ["string"],
            nodeType: "string",
            "evictionPolicy?": "string",
            "isTlsEnabled?": "boolean",
            "haConfig?": {
                "numReplicasPerShard?": "number",
                "reliabilityConfig?": {
                    "numShards?": "number"
                }
            }
        });
        const haConfig = config.haConfig;
        const reliabilityConfig = haConfig?.reliabilityConfig;
        config.isTlsEnabled ??= haConfig != null;
        config.evictionPolicy ??= reliabilityConfig != null
            ? ValkeyEvictionPolicy.noeviction
            : ValkeyEvictionPolicy.allkeysLru;
        given(config.evictionPolicy, "config.evictionPolicy").ensureIsEnum(ValkeyEvictionPolicy);
        if (haConfig != null) {
            haConfig.numReplicasPerShard ??= 1;
            given(haConfig, "config.haConfig").ensure(t => t.numReplicasPerShard >= 1 && t.numReplicasPerShard <= ValkeyProvisioner._maxReplicasPerShard, `numReplicasPerShard must be between 1 and ${ValkeyProvisioner._maxReplicasPerShard}`);
        }
        if (reliabilityConfig != null) {
            reliabilityConfig.numShards ??= 1;
            given(reliabilityConfig, "config.haConfig.reliabilityConfig").ensure(t => t.numShards >= 1, "numShards must be at least 1");
            given(config, "config")
                .ensure(t => t.isTlsEnabled === true, "reliabilityConfig requires in transit encryption; isTlsEnabled cannot be false")
                .ensure(t => t.nodeType.split(".").length === 3
                && ValkeyProvisioner._durableNodeTypeFamilies.contains(t.nodeType.split(".")[1]), `reliabilityConfig requires a node type from one of the following families: ${ValkeyProvisioner._durableNodeTypeFamilies.join(", ")}`);
        }
        this._config = config;
    }
    provision() {
        const valkeyPort = 6379;
        const haConfig = this._config.haConfig;
        const reliabilityConfig = haConfig?.reliabilityConfig;
        const isHA = haConfig != null;
        const isTls = this._config.isTlsEnabled;
        // durability is only supported on cluster mode enabled clusters
        const isClusterMode = reliabilityConfig != null;
        // cluster mode disabled node count, the primary included
        const numCacheClusters = isHA ? 1 + haConfig.numReplicasPerShard : 1;
        const cacheSubnets = this._config.vpcDetails
            .resolveSubnets([this._config.subnetNamePrefix]);
        const cacheSubnetAzs = cacheSubnets.map(t => t.availabilityZone).distinct().orderBy();
        given(cacheSubnetAzs, "cacheSubnetAzs").ensure(t => t.length >= (isHA ? 2 : 1), `the cache subnets resolved from subnetNamePrefix '${this._config.subnetNamePrefix}' must span at least ${isHA ? 2 : 1} availability zones`);
        // the az list handed to preferredCacheClusterAzs must be exactly as long as
        // numCacheClusters, so cycle through the available azs when there are more nodes than azs
        const resolveAzs = (count) => Array.from({ length: count }, (_, i) => cacheSubnetAzs[i % cacheSubnetAzs.length]);
        const subnetGroupName = `${this._name}-vk-sgrp`;
        const subnetGroup = new aws.elasticache.SubnetGroup(subnetGroupName, {
            subnetIds: cacheSubnets.map(t => t.id),
            tags: {
                ...NfraConfig.tags,
                Name: subnetGroupName
            }
        });
        const ingressCidrBlocks = this._config.vpcDetails
            .resolveSubnets(this._config.ingressSubnetNamePrefixes)
            .map(u => u.cidrBlock);
        const secGroupName = `${this._name}-vk-sg`;
        const secGroup = new aws.ec2.SecurityGroup(secGroupName, {
            vpcId: this._config.vpcDetails.vpc.id,
            revokeRulesOnDelete: true,
            ingress: [{
                    protocol: "tcp",
                    fromPort: valkeyPort,
                    toPort: valkeyPort,
                    cidrBlocks: ingressCidrBlocks
                }],
            tags: {
                ...NfraConfig.tags,
                Name: secGroupName
            }
        });
        const paramGroupName = `${this._name}-vk-pgrp`;
        const paramGroup = new aws.elasticache.ParameterGroup(paramGroupName, {
            family: ValkeyProvisioner._paramGroupFamily,
            parameters: [
                {
                    name: "maxmemory-policy",
                    value: this._config.evictionPolicy
                },
                ...isClusterMode
                    ? [{
                            name: "cluster-enabled",
                            value: "yes"
                        }]
                    : []
            ],
            tags: {
                ...NfraConfig.tags,
                Name: paramGroupName
            }
        });
        // annotated so that every key is checked against the resource args;
        // spreading an unannotated object literal would silently drop a mistyped key.
        //
        // note the two apis count differently: numCacheClusters is the total node count with the
        // primary included, whereas replicasPerNodeGroup excludes the primary, so the cluster mode
        // enabled node count is numShards * (1 + numReplicasPerShard)
        const topologyArgs = reliabilityConfig != null
            ? {
                // durability requires cluster mode enabled, multi AZ with at least one replica
                // per shard, and in transit encryption enabled at creation
                durability: "sync",
                numNodeGroups: reliabilityConfig.numShards,
                replicasPerNodeGroup: haConfig.numReplicasPerShard,
                multiAzEnabled: true,
                automaticFailoverEnabled: true
                // preferredCacheClusterAzs is ignored past one node group, so it is left unset
                // and elasticache distributes the nodes across the subnet group itself
            }
            : {
                numCacheClusters,
                // must be covered by the subnet group, and must match numCacheClusters in length.
                // the first entry becomes the primary
                preferredCacheClusterAzs: resolveAzs(numCacheClusters),
                multiAzEnabled: isHA,
                automaticFailoverEnabled: isHA
            };
        const isProd = NfraConfig.env === EnvType.prod;
        const replicationGroupName = `${this._name}-vk-rgrp`;
        const replicationGroup = new aws.elasticache.ReplicationGroup(replicationGroupName, {
            ...topologyArgs,
            description: `${this._name}-valkey-replication-group`,
            engine: "valkey",
            engineVersion: ValkeyProvisioner._engineVersion,
            autoMinorVersionUpgrade: true,
            parameterGroupName: paramGroup.name,
            nodeType: this._config.nodeType,
            port: valkeyPort,
            transitEncryptionEnabled: isTls,
            ...isTls ? { transitEncryptionMode: "required" } : {},
            atRestEncryptionEnabled: true,
            snapshotWindow: "05:00-09:00",
            snapshotRetentionLimit: isProd ? 5 : 1,
            maintenanceWindow: "sun:02:00-sun:04:00",
            subnetGroupName: subnetGroup.name,
            securityGroupIds: [secGroup.id],
            applyImmediately: true,
            tags: {
                ...NfraConfig.tags,
                Name: replicationGroupName
            }
        });
        // the primary endpoint is not populated when cluster mode is enabled
        const host = isClusterMode
            ? replicationGroup.configurationEndpointAddress
            : replicationGroup.primaryEndpointAddress;
        return {
            host,
            port: valkeyPort,
            tls: isTls,
            isClusterMode,
            url: Pulumi.interpolate `${isTls ? "rediss" : "redis"}://${host}:${valkeyPort}`
        };
    }
}
//# sourceMappingURL=valkey-provisioner.js.map