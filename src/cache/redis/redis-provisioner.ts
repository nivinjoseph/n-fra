import { given } from "@nivinjoseph/n-defensive";
// import { ParameterGroup, ReplicationGroup, SubnetGroup } from "@pulumi/aws/elasticache";
import * as aws from "@pulumi/aws";
import { RedisConfig } from "./redis-config";
import * as Pulumi from "@pulumi/pulumi";
import { NfraConfig } from "../../nfra-config";
// import { SecurityGroup } from "@pulumi/awsx/ec2";
import { EnvType } from "../../env-type";
import { VpcAz } from "../../vpc/vpc-az";
import { RedisDetails } from "./redis-details";


export class RedisProvisioner
{
    private readonly _name: string;
    private readonly _config: RedisConfig;
    
    
    public constructor(name: string, config: RedisConfig)
    {
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
        
        given(config, "config").ensureHasValue().ensureIsObject().ensureHasStructure({
            vpcDetails: "object",
            subnetNamePrefix: "string",
            ingressSubnetNamePrefixes: ["string"],
            nodeType: "string"
        });
        this._config = config;
    }


    public provision(): RedisDetails
    {
        const redisPort = 6379;        
        
        const subnetGroupName = `${this._name}-subnet-grp`;
        const subnetGroup = new aws.elasticache.SubnetGroup(subnetGroupName, {
            subnetIds: Pulumi.output(this._config.vpcDetails.vpc.getSubnets("isolated"))
                .apply((subnets) => subnets.where(t => t.subnetName.startsWith(this._config.subnetNamePrefix)).map(t => t.id)),
            tags: {
                ...NfraConfig.tags,
                Name: subnetGroupName
            }
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
                    .apply((subnets) =>
                        subnets.where(subnet =>
                            this._config.ingressSubnetNamePrefixes.some(prefix =>
                                subnet.subnetName.startsWith(prefix)))
                            .map(t => t.subnet.cidrBlock as Pulumi.Output<string>))
            }],
            tags: {
                ...NfraConfig.tags,
                Name: secGroupName
            }
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
            tags: {
                ...NfraConfig.tags,
                Name: paramGroupName
            }
        });
        
        const isProd = NfraConfig.env === EnvType.prod;

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
                NfraConfig.awsRegion + VpcAz.a,
                NfraConfig.awsRegion + VpcAz.b,
                NfraConfig.awsRegion + VpcAz.c
            ] : [
                NfraConfig.awsRegion + VpcAz.a
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