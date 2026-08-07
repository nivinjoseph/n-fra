import { given } from "@nivinjoseph/n-defensive";
import * as aws from "@pulumi/aws";
import * as Pulumi from "@pulumi/pulumi";
import { ValkeyConfig } from "./valkey-config.js";
import { NfraConfig } from "../../common/nfra-config.js";
import { EnvType } from "../../common/env-type.js";
import { ValkeyDetails } from "./valkey-details.js";
import { ValkeyDurability } from "./valkey-durability.js";
import { ValkeyEvictionPolicy } from "./valkey-eviction-policy.js";


export class ValkeyProvisioner
{
    private static readonly _engineVersion = "9.1";
    private static readonly _paramGroupFamily = "valkey9";

    /**
     * @description Node type families that support durability.
     * https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Durability.Limitations.html
     */
    private static readonly _durableNodeTypeFamilies = ["r8g", "r7g", "r6g", "m8g", "m7g", "m6g", "c8gn", "c7gn"];

    private readonly _name: string;
    private readonly _config: ValkeyConfig;


    public constructor(name: string, config: ValkeyConfig)
    {
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name;

        given(config, "config").ensureHasValue().ensureIsObject().ensureHasStructure({
            vpcDetails: "object",
            subnetNamePrefix: "string",
            ingressSubnetNamePrefixes: ["string"],
            nodeType: "string",
            "evictionPolicy?": "string",
            "haConfig?": {
                "durability?": "string",
                "numShards?": "number",
                "numReplicasPerShard?": "number"
            }
        });

        const haConfig = config.haConfig;

        config.evictionPolicy ??= haConfig != null
            ? ValkeyEvictionPolicy.volatileTtl
            : ValkeyEvictionPolicy.allkeysLru;
        given(config.evictionPolicy as string, "config.evictionPolicy").ensureIsEnum(ValkeyEvictionPolicy);

        if (haConfig != null)
        {
            haConfig.durability ??= ValkeyDurability.sync;
            haConfig.numShards ??= 1;
            haConfig.numReplicasPerShard ??= 1;

            given(haConfig.durability as string, "config.haConfig.durability").ensureIsEnum(ValkeyDurability);

            given(haConfig, "config.haConfig")
                .ensure(t => t.numShards! >= 1, "numShards must be at least 1")
                .ensure(t => t.numReplicasPerShard! >= 1, "durability requires at least 1 replica per shard");

            given(config, "config").ensure(
                t => t.nodeType.split(".").length === 3
                    && ValkeyProvisioner._durableNodeTypeFamilies.contains(t.nodeType.split(".")[1]),
                `haConfig requires a node type from one of the following families: ${ValkeyProvisioner._durableNodeTypeFamilies.join(", ")}`);
        }

        this._config = config;
    }


    public provision(): ValkeyDetails
    {
        const valkeyPort = 6379;

        const haConfig = this._config.haConfig;
        const isHA = haConfig != null;
        // durability mandates in transit encryption at cluster creation,
        // and is only supported on cluster mode enabled clusters
        const isTls = isHA;
        const isClusterMode = isHA;

        const cacheSubnets = this._config.vpcDetails
            .resolveSubnets([this._config.subnetNamePrefix]);

        const cacheSubnetAzs = cacheSubnets.map(t => t.availabilityZone).distinct().orderBy();

        given(cacheSubnetAzs, "cacheSubnetAzs").ensure(
            t => t.length >= (isHA ? 2 : 1),
            `the cache subnets resolved from subnetNamePrefix '${this._config.subnetNamePrefix}' must span at least ${isHA ? 2 : 1} availability zones`);

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
                    value: this._config.evictionPolicy!
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
        // note the two apis count differently: numCacheClusters is the total node count with
        // the primary included, whereas replicasPerNodeGroup excludes the primary, so the
        // durable node count is numShards * (1 + numReplicasPerShard)
        const topologyArgs: Partial<aws.elasticache.ReplicationGroupArgs> = haConfig != null
            ? {
                // durability requires cluster mode enabled, multi AZ with at least one replica
                // per shard, and in transit encryption enabled at creation
                durability: haConfig.durability,
                numNodeGroups: haConfig.numShards,
                replicasPerNodeGroup: haConfig.numReplicasPerShard,
                multiAzEnabled: true,
                automaticFailoverEnabled: true,
                transitEncryptionEnabled: true,
                transitEncryptionMode: "required"
            }
            : {
                numCacheClusters: 1,
                // must be covered by the subnet group, and must match numCacheClusters in length
                preferredCacheClusterAzs: cacheSubnetAzs.take(1),
                multiAzEnabled: false,
                automaticFailoverEnabled: false,
                transitEncryptionEnabled: false
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
            url: Pulumi.interpolate`${isTls ? "rediss" : "redis"}://${host}:${valkeyPort}`
        };
    }
}
