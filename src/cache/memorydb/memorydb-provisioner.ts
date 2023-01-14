import { given } from "@nivinjoseph/n-defensive";
// import { Cluster, ParameterGroup, SubnetGroup } from "@pulumi/aws/memorydb";
import * as aws from "@pulumi/aws";
import { MemorydbConfig } from "./memorydb-config";
import { MemorydbDetails } from "./memorydb-details";
import * as Pulumi from "@pulumi/pulumi";
import { NfraConfig } from "../../nfra-config";
// import { SecurityGroup } from "@pulumi/awsx/ec2";
import { EnvType } from "../../env-type";


export class MemorydbProvisioner
{
    private readonly _name: string;
    private readonly _config: MemorydbConfig;


    public constructor(name: string, config: MemorydbConfig)
    {
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name;

        given(config, "config").ensureHasValue().ensureIsObject().ensureHasStructure({
            vpcDetails: "object",
            subnetNamePrefix: "string",
            ingressSubnetNamePrefixes: ["string"],
            nodeType: "string",
            "numShards?": "number"
        });
        config.numShards ??= 1;
        this._config = config;
    }


    public provision(): MemorydbDetails
    {
        const memorydbPort = 6379;
        
        const subnetGroupName = `${this._name}-subnet-grp`;
        const subnetGroup = new aws.memorydb.SubnetGroup(subnetGroupName, {
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
                fromPort: memorydbPort,
                toPort: memorydbPort,
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
            tags: {
                ...NfraConfig.tags,
                Name: paramGroupName
            }
        });
        
        const isProd = NfraConfig.env === EnvType.prod;

        const clusterName = `${this._name}-cluster`;
        const memdbCluster = new aws.memorydb.Cluster("memdb-cluster", {
            nodeType: this._config.nodeType,
            engineVersion: "6.2",
            numShards: this._config.numShards!,
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
            tags: {
                ...NfraConfig.tags,
                Name: clusterName
            }
        });

        return {
            endpoints: memdbCluster.clusterEndpoints
                .apply(endpoints => endpoints.map(t => `${t.address}:${t.port}`).join(","))
        };
    }
}