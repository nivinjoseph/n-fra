import { given } from "@nivinjoseph/n-defensive";
import { Cluster, ParameterGroup, SubnetGroup } from "@pulumi/aws/memorydb";
import { VpcDetails } from "../../vpc/vpc-details";
import { MemorydbConfig } from "./memorydb-config";
import { MemorydbDetails } from "./memorydb-details";
import * as Pulumi from "@pulumi/pulumi";
import { InfraConfig } from "../../infra-config";
import { SecurityGroup } from "@pulumi/awsx/ec2";
import { EnvType } from "../../env-type";


export class MemorydbProvisioner
{
    private readonly _name: string;
    private readonly _vpcDetails: VpcDetails;
    private readonly _config: MemorydbConfig;


    public constructor(name: string, vpcDetails: VpcDetails, config: MemorydbConfig)
    {
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name;

        given(vpcDetails, "vpcDetails").ensureHasValue().ensureIsObject();
        this._vpcDetails = vpcDetails;

        given(config, "config").ensureHasValue().ensureIsObject().ensureHasStructure({
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
        const subnetGroup = new SubnetGroup(subnetGroupName, {
            subnetIds: Pulumi.output(this._vpcDetails.vpc.getSubnets("isolated"))
                .apply((subnets) => subnets.where(t => t.subnetName.startsWith(this._config.subnetNamePrefix)).map(t => t.id)),
            tags: {
                ...InfraConfig.tags,
                Name: subnetGroupName
            }
        });
        
        const secGroupName = `${this._name}-sg`;
        const secGroup = new SecurityGroup(secGroupName, {
            vpc: this._vpcDetails.vpc,
            ingress: [{
                protocol: "tcp",
                fromPort: memorydbPort,
                toPort: memorydbPort,
                cidrBlocks: Pulumi.output(this._vpcDetails.vpc.getSubnets("private"))
                    .apply((subnets) =>
                        subnets.where(subnet =>
                            this._config.ingressSubnetNamePrefixes.some(prefix =>
                                subnet.subnetName.startsWith(prefix)))
                            .map(t => t.subnet.cidrBlock as Pulumi.Output<string>))
            }],
            tags: {
                ...InfraConfig.tags,
                Name: secGroupName
            }
        });

        const paramGroupName = `${this._name}-param-grp`;
        const paramGroup = new ParameterGroup(paramGroupName, {
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
                ...InfraConfig.tags,
                Name: paramGroupName
            }
        });
        
        const isProd = InfraConfig.env === EnvType.prod;

        const clusterName = `${this._name}-cluster`;
        const memdbCluster = new Cluster("memdb-cluster", {
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
                ...InfraConfig.tags,
                Name: clusterName
            }
        });

        return {
            endpoints: memdbCluster.clusterEndpoints
                .apply(endpoints => endpoints.map(t => `${t.address}:${t.port}`).join(","))
        };
    }
}