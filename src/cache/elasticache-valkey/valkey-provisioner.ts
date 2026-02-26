import { given } from "@nivinjoseph/n-defensive";
// import { ParameterGroup, ReplicationGroup, SubnetGroup } from "@pulumi/aws/elasticache";
import * as aws from "@pulumi/aws";
import { ValkeyConfig } from "./valkey-config.js";
import { NfraConfig } from "../../common/nfra-config.js";
import { ValkeyDetails } from "./valkey-details.js";


export class ValkeyProvisioner
{
    private readonly _name: string;
    private readonly _config: ValkeyConfig;


    public constructor(name: string, config: ValkeyConfig)
    {
        // this._name = CommonHelper.prefixName(name);
        given(name, "name").ensureHasValue().ensureIsString();
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


    public provision(): ValkeyDetails
    {
        const redisPort = 6379;

        const cacheSubnets = this._config.vpcDetails
            .resolveSubnets([this._config.subnetNamePrefix]);

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
            // .apply(subnets => subnets.map(u => u.cidrBlock));

        const secGroupName = `${this._name}-vk-sg`;
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

        const paramGroupName = `${this._name}-vk-pgrp`;
        const paramGroup = new aws.elasticache.ParameterGroup(paramGroupName, {
            family: "valkey8",
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

        const replicationGroupName = `${this._name}-vk-rgrp`;
        const replicationGroup = new aws.elasticache.ReplicationGroup(replicationGroupName, {
            // replicationGroupDescription: `${this._name}-replication-group`,
            description: `${this._name}-valkey-replication-group`,
            engine: "valkey",
            engineVersion: "8.0",
            parameterGroupName: paramGroup.name,
            nodeType: this._config.nodeType,
            port: redisPort,
            numCacheClusters: isHA ? 2 : 1,
            multiAzEnabled: isHA,
            preferredCacheClusterAzs: isHA
                ? NfraConfig.awsRegionAvailabilityZones.take(2)
                : [NfraConfig.awsRegionAvailabilityZones.takeFirst()],
            automaticFailoverEnabled: isHA,
            transitEncryptionEnabled: true,
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