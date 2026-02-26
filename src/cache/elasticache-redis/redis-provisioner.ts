import { given } from "@nivinjoseph/n-defensive";
// import { ParameterGroup, ReplicationGroup, SubnetGroup } from "@pulumi/aws/elasticache";
import * as aws from "@pulumi/aws";
import { RedisConfig } from "./redis-config.js";
import { NfraConfig } from "../../common/nfra-config.js";
import { RedisDetails } from "./redis-details.js";
// import { CommonHelper } from "../../common/common-helper.js";


export class RedisProvisioner
{
    private readonly _name: string;
    private readonly _config: RedisConfig;


    public constructor(name: string, config: RedisConfig)
    {
        this._name = name;

        given(config, "config").ensureHasValue().ensureIsObject().ensureHasStructure({
            vpcDetails: "object",
            subnetNamePrefix: "string",
            ingressSubnetNamePrefixes: ["string"],
            nodeType: "string",
            "isHA?": "boolean"
        });
        this._config = config;
    }


    public provision(): RedisDetails
    {
        const redisPort = 6379;

        const cacheSubnets = this._config.vpcDetails
            .resolveSubnets([this._config.subnetNamePrefix]);

        const subnetGroupName = `${this._name}-re-sgrp`;
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
            // .apply(subnets => subnets.map(u => u.cidrBlock));

        const secGroupName = `${this._name}-re-sg`;
        const secGroup = new aws.ec2.SecurityGroup(secGroupName, {
            vpcId: this._config.vpcDetails.vpc.id,
            revokeRulesOnDelete: true,
            ingress: [{
                protocol: "tcp",
                fromPort: redisPort,
                toPort: redisPort,
                cidrBlocks: ingressCidrBlocks
            }],
            tags: {
                ...NfraConfig.tags,
                Name: secGroupName
            }
        }, {
            // replaceOnChanges: ["*"]
        });

        const paramGroupName = `${this._name}-re-pgrp`;
        const paramGroup = new aws.elasticache.ParameterGroup(paramGroupName, {
            family: "redis6.x",
            parameters: [{
                name: "maxmemory-policy",
                value: "allkeys-lru"
            }],
            tags: {
                ...NfraConfig.tags,
                Name: paramGroupName
            }
        });

        const isHA = this._config.isHA;

        const replicationGroupName = `${this._name}-re-rgrp`;
        const replicationGroup = new aws.elasticache.ReplicationGroup(replicationGroupName, {
            // replicationGroupDescription: `${this._name}-replication-group`,
            description: `${this._name}-redis-replication-group`,
            engine: "redis",
            engineVersion: "6.2",
            parameterGroupName: paramGroup.name,
            // parameterGroupName: "default.redis5.0.cluster.on",
            // parameterGroupName: "default.redis6.2",
            nodeType: this._config.nodeType,
            port: redisPort,
            numCacheClusters: isHA ? 2 : 1,
            multiAzEnabled: isHA,
            preferredCacheClusterAzs: isHA
                ? NfraConfig.awsRegionAvailabilityZones.take(2)
                : [NfraConfig.awsRegionAvailabilityZones.takeFirst()],
            automaticFailoverEnabled: isHA,
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
            tags: {
                ...NfraConfig.tags,
                Name: replicationGroupName
            }
        });

        return {
            host: replicationGroup.primaryEndpointAddress,
            port: redisPort
        };
    }
}