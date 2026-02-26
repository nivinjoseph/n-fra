import { given } from "@nivinjoseph/n-defensive";
import * as aws from "@pulumi/aws";
import { NfraConfig } from "../../common/nfra-config.js";
export class MongoDocumentdbProvisioner {
    constructor(name, config) {
        // this._name = CommonHelper.prefixName(name);
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
        given(config, "config").ensureHasValue().ensureIsObject();
        this._config = config;
    }
    provision() {
        const mongoPort = 27017;
        const serviceSubnets = this._config.vpcDetails
            .resolveSubnets([this._config.subnetNamePrefix])
            .map(u => u.id);
        // .apply(t => t.map(u => u.id));
        const subnetGroupName = `${this._name}-sng`;
        const subnetGroup = new aws.docdb.SubnetGroup(subnetGroupName, {
            subnetIds: serviceSubnets,
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: subnetGroupName })
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
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: secGroupName })
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
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: parameterGroupName })
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
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: clusterName })
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
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: clusterInstanceName })
        });
        return {
            host: dbCluster.endpoint,
            port: mongoPort,
            username: this._config.username,
            password: this._config.password
        };
    }
}
//# sourceMappingURL=mongo-documentdb-provisioner.js.map