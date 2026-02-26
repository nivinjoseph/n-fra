// import { given } from "@nivinjoseph/n-defensive";
// // import { Cluster, EngineMode, EngineType, SubnetGroup } from "@pulumi/aws/rds";
// import * as aws from "@pulumi/aws";
// import { Aspv1Config } from "./aspv1-config.js";
// import { Aspv1Details } from "./aspv1-details.js";
// import * as Pulumi from "@pulumi/pulumi";
// import { NfraConfig } from "../../common/nfra-config.js";
// // import { RandomPassword } from "@pulumi/random";
// import * as random from "@pulumi/random";
// import { EnvType } from "../../common/env-type.js";
export {};
// export class Aspv1Provisioner
// {
//     private readonly _name: string;
//     private readonly _config: Aspv1Config;
//     public constructor(name: string, config: Aspv1Config)
//     {
//         // this._name = CommonHelper.prefixName(name);
//         given(name, "name").ensureHasValue().ensureIsString();
//         this._name = name;
//         given(config, "config").ensureHasValue().ensureIsObject().ensureHasStructure({
//             vpcDetails: "object",
//             subnetNamePrefix: "string",
//             ingressSubnetNamePrefixes: ["string"],
//             databaseName: "string",
//             minCapacity: "number",
//             maxCapacity: "number",
//             autoPause: "boolean",
//             deletionProtection: "boolean",
//             skipFinalSnapshot: "boolean"
//         });
//         this._config = config;
//     }
//     public provision(): Aspv1Details
//     {
//         const postgresDbPort = 5432;
//         const dbSubnets = this._config.vpcDetails
//             .resolveSubnets([this._config.subnetNamePrefix]);
//         const subnetGroupName = `${this._name}-subnet-grp`;
//         const subnetGroup = new aws.rds.SubnetGroup(subnetGroupName, {
//             subnetIds: dbSubnets.apply((subnets) => subnets.map(t => t.id)),
//             tags: {
//                 ...NfraConfig.tags,
//                 Name: subnetGroupName
//             }
//         });
//         const ingressCidrBlocks = this._config.vpcDetails
//             .resolveSubnets(this._config.ingressSubnetNamePrefixes)
//             .apply(subnets => subnets.map(u => u.cidrBlock));
//         const secGroupName = `${this._name}-sg`;
//         const secGroup = new aws.ec2.SecurityGroup(secGroupName, {
//             vpcId: this._config.vpcDetails.vpc.id,
//             revokeRulesOnDelete: true,
//             ingress: [{
//                 protocol: "tcp",
//                 fromPort: postgresDbPort,
//                 toPort: postgresDbPort,
//                 cidrBlocks: ingressCidrBlocks
//             }],
//             tags: {
//                 ...NfraConfig.tags,
//                 Name: secGroupName
//             }
//         }, {
//             // replaceOnChanges: ["*"]
//         });
//         const dbPassword = new random.RandomPassword(`${this._name}-rpass`, {
//             length: 16,
//             special: true,
//             overrideSpecial: `_`
//         });
//         const isProd = NfraConfig.env === EnvType.prod;
//         const clusterName = `${this._name}-cluster`;
//         const postgresDbCluster = new aws.rds.Cluster(clusterName, {
//             availabilityZones: NfraConfig.awsRegionAvailabilityZones,
//             engine: aws.rds.EngineType.AuroraPostgresql,
//             // allowMajorVersionUpgrade: false,
//             // engineVersion: "", // TODO: this needs to be configurable, not sure if this can be set for serverless v1
//             engineMode: aws.rds.EngineMode.Serverless,
//             dbSubnetGroupName: subnetGroup.name,
//             vpcSecurityGroupIds: [secGroup.id],
//             databaseName: this._config.databaseName,
//             masterUsername: "appuser",
//             masterPassword: Pulumi.secret(dbPassword.result),
//             port: postgresDbPort,
//             storageEncrypted: true,
//             // enabledCloudwatchLogsExports: ["postgresql"], // not supported by aurora serverless
//             scalingConfiguration: {
//                 minCapacity: this._config.minCapacity,
//                 maxCapacity: this._config.maxCapacity,
//                 autoPause: this._config.autoPause
//             },
//             enableHttpEndpoint: false,
//             // preferredBackupWindow: "05:00-09:00", // You can't set the preferred backup window for an Aurora Serverless v1 DB cluster.
//             backupRetentionPeriod: isProd ? 5 : 1,
//             // backupRetentionPeriod: 0, // to facilitate delete
//             deletionProtection: this._config.deletionProtection, // to facilitate delete
//             skipFinalSnapshot: this._config.skipFinalSnapshot, // to facilitate delete
//             applyImmediately: true,
//             tags: {
//                 ...NfraConfig.tags,
//                 Name: clusterName
//             }
//         });
//         return {
//             host: postgresDbCluster.endpoint,
//             port: postgresDbPort,
//             databaseName: postgresDbCluster.databaseName,
//             username: postgresDbCluster.masterUsername,
//             password: postgresDbCluster.masterPassword as Pulumi.Output<string>,
//             readerHost: postgresDbCluster.readerEndpoint
//         };
//     }
// }
//# sourceMappingURL=aspv1-provisioner.js.map