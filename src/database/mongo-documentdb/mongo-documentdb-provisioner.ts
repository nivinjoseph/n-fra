import { given } from "@nivinjoseph/n-defensive";
import { MongoDocumentdbConfig } from "./mongo-documentdb-config.js";
import { MongoDocumentdbDetails } from "./mongo-documentdb-details.js";
import * as aws from "@pulumi/aws";
import { NfraConfig } from "../../common/nfra-config.js";


export class MongoDocumentdbProvisioner
{
    private readonly _name: string;
    private readonly _config: MongoDocumentdbConfig;
    
    
    public constructor(name: string, config: MongoDocumentdbConfig)
    {
        // this._name = CommonHelper.prefixName(name);
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
        
        given(config, "config").ensureHasValue().ensureIsObject();   
        this._config = config;
    }
    
    
    public provision(): MongoDocumentdbDetails
    {
        const mongoPort = 27017;
        
        const serviceSubnets = this._config.vpcDetails
            .resolveSubnets([this._config.subnetNamePrefix])
            .map(u => u.id);
            // .apply(t => t.map(u => u.id));
        
        const subnetGroupName = `${this._name}-sng`;
        const subnetGroup = new aws.docdb.SubnetGroup(subnetGroupName, {
            subnetIds: serviceSubnets,
            tags: {
                ...NfraConfig.tags,
                Name: subnetGroupName
            }
        });
        
        const ingressCidrBlocks = this._config.vpcDetails
            .resolveSubnets(this._config.ingressSubnetNamePrefixes)
            .map(u => u.cidrBlock);
            // .apply(subnets => subnets.map(u => u.cidrBlock));
        
        const secGroupName = `${this._name}-sg`;
        const secGroup = new aws.ec2.SecurityGroup(secGroupName, {
            vpcId: this._config.vpcDetails.vpc.id,
            revokeRulesOnDelete: true,
            ingress: [{
                protocol: "tcp",
                fromPort: mongoPort,
                toPort: mongoPort,
                cidrBlocks: ingressCidrBlocks
            }],
            tags: {
                ...NfraConfig.tags,
                Name: secGroupName
            }
        }, {
            // replaceOnChanges: ["*"]
        });
        
        const parameterGroupName = `${this._name}-pmg`;
        const parameterGroup = new aws.docdb.ClusterParameterGroup(parameterGroupName, {
            description: `${parameterGroupName} Mongo documentdb 5.0 cluster parameter group`,
            family: "docdb5.0",
            parameters: [{
                name: "tls",
                value: "disabled"
            }],
            tags: {
                ...NfraConfig.tags,
                Name: parameterGroupName
            }
        });
        
        const clusterName = `${this._name}-cls`;
        const dbCluster = new aws.docdb.Cluster(clusterName, {
            clusterIdentifier: clusterName,
            applyImmediately: true,
            availabilityZones: NfraConfig.awsRegionAvailabilityZones,
            backupRetentionPeriod: 5,
            engine: "docdb",
            masterUsername: this._config.username,
            masterPassword: this._config.password,
            port: mongoPort,
            dbSubnetGroupName: subnetGroup.name,
            vpcSecurityGroupIds: [secGroup.id],
            storageEncrypted: true,
            deletionProtection: false, // FIXME: consider this
            skipFinalSnapshot: true,
            enabledCloudwatchLogsExports: ["audit", "profiler"],
            preferredMaintenanceWindow: "wed:03:00-wed:03:30",
            preferredBackupWindow: "05:00-07:00",
            dbClusterParameterGroupName: parameterGroup.name,
            allowMajorVersionUpgrade: false,
            storageType: "iopt1",
            tags: {
                ...NfraConfig.tags,
                Name: clusterName
            }
        });

        const clusterInstanceName = `${this._name}-cls-ins`;
        const _clusterInstance = new aws.docdb.ClusterInstance(clusterInstanceName, {
            identifier: clusterInstanceName,
            availabilityZone: NfraConfig.awsRegionAvailabilityZones.takeFirst(),
            applyImmediately: false,
            clusterIdentifier: dbCluster.id,
            autoMinorVersionUpgrade: true,
            instanceClass: "db.t3.medium", // TODO: make this configurable
            enablePerformanceInsights: true,
            tags: {
                ...NfraConfig.tags,
                Name: clusterInstanceName
            }
        });
        
        return {
            host: dbCluster.endpoint,
            port: mongoPort,
            username: this._config.username,
            password: this._config.password
        };
    }
}