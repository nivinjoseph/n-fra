import { given } from "@nivinjoseph/n-defensive";
import { Cluster, EngineMode, EngineType, SubnetGroup } from "@pulumi/aws/rds";
import { VpcInfo } from "../../vpc/vpc-info";
import { Aspv1Config } from "./aspv1-config";
import { Aspv1Details } from "./aspv1-details";
import * as Pulumi from "@pulumi/pulumi";
import { InfraConfig } from "../../infra-config";
import { SecurityGroup } from "@pulumi/awsx/ec2";
import { RandomPassword } from "@pulumi/random";
import { VpcAz } from "../../vpc/vpc-az";
import { EnvType } from "../../env-type";


export class Aspv1Provisioner
{
    private readonly _name: string;
    private readonly _vpcInfo: VpcInfo;
    private readonly _config: Aspv1Config;


    public constructor(name: string, vpcInfo: VpcInfo, config: Aspv1Config)
    {
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name;

        given(vpcInfo, "vpcInfo").ensureHasValue().ensureIsObject();
        this._vpcInfo = vpcInfo;

        given(config, "config").ensureHasValue().ensureIsObject().ensureHasStructure({
            subnetNamePrefix: "string",
            ingressSubnetNamePrefixes: ["string"],
            databaseName: "string",
            minCapacity: "number",
            maxCapacity: "number",
            autoPause: "boolean",
            deletionProtection: "boolean",
            skipFinalSnapshot: "boolean"
        });
        this._config = config;
    }
    
    
    public provision(): Aspv1Details
    {
        const postgresDbPort = 5432;
        
        const subnetGroupName = `${this._name}-subnet-grp`;
        const subnetGroup = new SubnetGroup(subnetGroupName, {
            subnetIds: Pulumi.output(this._vpcInfo.vpc.getSubnets("isolated"))
                .apply((subnets) => subnets.where(t => t.subnetName.startsWith(this._config.subnetNamePrefix)).map(t => t.id)),
            tags: {
                ...InfraConfig.tags,
                Name: subnetGroupName
            }
        });
        
        const secGroupName = `${this._name}-sg`;
        const secGroup = new SecurityGroup(secGroupName, {
            vpc: this._vpcInfo.vpc,
            ingress: [{
                protocol: "tcp",
                fromPort: postgresDbPort,
                toPort: postgresDbPort,
                cidrBlocks: Pulumi.output(this._vpcInfo.vpc.getSubnets("private"))
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

        const dbPassword = new RandomPassword(`${this._name}-rpass`, {
            length: 16,
            special: true,
            overrideSpecial: `_`
        });

        const isProd = InfraConfig.env === EnvType.prod;
        
        const clusterName = `${this._name}-cluster`;
        const postgresDbCluster = new Cluster(clusterName, {
            availabilityZones: [
                InfraConfig.awsRegion + VpcAz.a,
                InfraConfig.awsRegion + VpcAz.b,
                InfraConfig.awsRegion + VpcAz.c
            ],
            engine: EngineType.AuroraPostgresql,
            allowMajorVersionUpgrade: false,
            // engineVersion: "", // TODO: this needs to be configurable, not sure if this can be set for serverless v1
            engineMode: EngineMode.Serverless,
            dbSubnetGroupName: subnetGroup.name,
            vpcSecurityGroupIds: [secGroup.id],
            databaseName: this._config.databaseName,
            masterUsername: "appuser",
            masterPassword: Pulumi.secret(dbPassword.result),
            port: postgresDbPort,
            storageEncrypted: true,
            // enabledCloudwatchLogsExports: ["postgresql"], // not supported by aurora serverless
            scalingConfiguration: {
                minCapacity: this._config.minCapacity,
                maxCapacity: this._config.maxCapacity,
                autoPause: this._config.autoPause
            },
            enableHttpEndpoint: false,
            // preferredBackupWindow: "05:00-09:00", // You can't set the preferred backup window for an Aurora Serverless v1 DB cluster.
            backupRetentionPeriod: isProd ? 5 : 1,
            // backupRetentionPeriod: 0, // to facilitate delete
            deletionProtection: this._config.deletionProtection, // to facilitate delete
            skipFinalSnapshot: this._config.skipFinalSnapshot, // to facilitate delete
            applyImmediately: true,
            tags: {
                ...InfraConfig.tags,
                Name: clusterName
            }
        });

        return {
            host: postgresDbCluster.endpoint,
            port: postgresDbCluster.port,
            databaseName: postgresDbCluster.databaseName,
            username: postgresDbCluster.masterUsername,
            password: postgresDbCluster.masterPassword as Pulumi.Output<string>,
            readerHost: postgresDbCluster.readerEndpoint
        };
    }
}