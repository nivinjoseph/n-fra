import { given } from "@nivinjoseph/n-defensive";
import { NfraConfig } from "../../common/nfra-config.js";
import { MariaInstanceConfig } from "./maria-instance-config.js";
import { MariaInstanceDetails } from "./maria-instance-details.js";
import * as aws from "@pulumi/aws";
import * as Pulumi from "@pulumi/pulumi";
import * as Random from "@pulumi/random";
import { SecurityGroupHelper } from "../../vpc/security-group-helper.js";


export class MariaInstanceProvisioner
{
    private readonly _name: string;
    private readonly _config: MariaInstanceConfig;


    public constructor(name: string, config: MariaInstanceConfig)
    {
        // this._name = CommonHelper.prefixName(name);
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name;

        given(config, "config").ensureHasValue().ensureIsObject()
            .ensureHasStructure({
                vpcDetails: "object",
                subnetNamePrefix: "string",
                ingressSubnetNamePrefixes: ["string"],
                "databaseName?": "string",
                "restoreSnapshotId?": "string",
                "username?": "string",
                "password?": "string",
                instanceClass: "string",
                storageGb: "number",
                maxStorageGb: "number",
                "storageEncrypted?": "boolean",
                "provisionedIops?": "number",
                "enableDedicatedLogVolumeForProvisionedIops?": "boolean",
                "deletionProtection?": "boolean",
                "isHA?": "boolean",
                "availabilityZone?": "string"
            })
            .ensure(t => !(t.databaseName == null && t.restoreSnapshotId == null),
                "must provide one of databaseName or restoreSnapshotId")
            .ensure(t => !(t.databaseName != null && t.restoreSnapshotId != null),
                "must provide only one of databaseName or restoreSnapshotId")
            .ensure(t => t.storageGb > 0 && t.storageGb <= t.maxStorageGb,
                "storageGb must be > 0 and <= maxStorageGb")
            .ensureWhen(config.provisionedIops != null,
                (t) => t.provisionedIops! > 0,
                "provisionedIops must be > 0")
            ;

        this._config = config;
    }


    public provision(): MariaInstanceDetails
    {
        const mariaDbPort = 3306;

        const serviceSubnets = this._config.vpcDetails
            .resolveSubnets([this._config.subnetNamePrefix])
            .map(u => u.id);
            // .apply(t => t.map(u => u.id));

        const subnetGroupName = `${this._name}-subnet-grp`;
        const subnetGroup = new aws.rds.SubnetGroup(subnetGroupName, {
            subnetIds: serviceSubnets,
            tags: {
                ...NfraConfig.tags,
                Name: subnetGroupName
            }
        });

        const ingressCidrBlocks = SecurityGroupHelper.resolveCidrBlocks(
            this._config.vpcDetails, this._config.ingressSubnetNamePrefixes);

        // const ingressCidrBlocks = this._config.vpcDetails
        //     .resolveSubnets(this._config.ingressSubnetNamePrefixes)
        //     .apply(subnets => subnets.map(u => u.cidrBlock));

        const secGroupName = `${this._name}-maria-sg`;
        const secGroup = new aws.ec2.SecurityGroup(secGroupName, {
            vpcId: this._config.vpcDetails.vpc.id,
            revokeRulesOnDelete: true,
            ingress: [{
                protocol: "tcp",
                fromPort: mariaDbPort,
                toPort: mariaDbPort,
                cidrBlocks: ingressCidrBlocks
            }],
            tags: {
                ...NfraConfig.tags,
                Name: secGroupName
            }
        }, {
            // replaceOnChanges: ["*"]
        });


        const username = this._config.username ?? "appuser";

        const monitoringAssumeRolePolicyDocument: aws.iam.PolicyDocument = {
            Version: "2012-10-17",
            Statement: [
                {
                    Action: "sts:AssumeRole",
                    Effect: "Allow",
                    "Principal": {
                        "Service": "monitoring.rds.amazonaws.com"
                    }
                }
            ]
        };

        const monitoringRoleName = `${this._name}-maria-mon-rle`;
        const monitoringRole = new aws.iam.Role(monitoringRoleName, {
            assumeRolePolicy: monitoringAssumeRolePolicyDocument,
            managedPolicyArns: ["arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"],
            forceDetachPolicies: true,
            tags: {
                ...NfraConfig.tags,
                Name: monitoringRoleName
            }
        });

        const paramGroupName = `${this._name}-maria-param-grp`;
        const paramGroup = new aws.rds.ParameterGroup(paramGroupName, {
            family: "mariadb10.6",
            parameters: [{
                name: "max_allowed_packet",
                value: "1024000000", // 1 GB
                applyMethod: "immediate"
            }],
            tags: {
                ...NfraConfig.tags,
                Name: paramGroupName
            }
        });

        const instanceName = `${this._name}-maria-db-ins`;
        const dbInstance = new aws.rds.Instance(instanceName, {
            dbName: this._config.databaseName ?? undefined,
            snapshotIdentifier: this._config.restoreSnapshotId ?? undefined,
            username,
            password: this._config.password ?? this._createPassword(),
            iamDatabaseAuthenticationEnabled: false,

            engine: "mariadb",
            engineVersion: "10.6",
            // parameterGroupName: "default.mariadb10.6",
            parameterGroupName: paramGroup.name,
            optionGroupName: "default:mariadb-10-6",
            licenseModel: "general-public-license",

            instanceClass: this._config.instanceClass,
            storageType: this._config.provisionedIops != null ? "io2" : "gp2",
            iops: this._config.provisionedIops ?? undefined,
            dedicatedLogVolume: this._config.provisionedIops != null
                ? this._config.enableDedicatedLogVolumeForProvisionedIops
                : undefined,
            allocatedStorage: this._config.storageGb,
            maxAllocatedStorage: this._config.maxStorageGb,
            storageEncrypted: this._config.storageEncrypted ?? false,
            // storageEncrypted: true,

            port: mariaDbPort,
            availabilityZone: this._config.isHA ? undefined : this._config.availabilityZone ?? NfraConfig.awsRegionAvailabilityZones.takeFirst(),
            multiAz: this._config.isHA,
            dbSubnetGroupName: subnetGroup.name,
            vpcSecurityGroupIds: [secGroup.id],
            publiclyAccessible: false,

            backupRetentionPeriod: 7,
            deleteAutomatedBackups: true,
            deletionProtection: this._config.deletionProtection ?? false,
            skipFinalSnapshot: true,

            allowMajorVersionUpgrade: false,
            autoMinorVersionUpgrade: true,

            enabledCloudwatchLogsExports: ["audit", "error", "general", "slowquery"], // https://docs.aws.amazon.com/AmazonRDS/latest/APIReference/API_CreateDBInstance.html#:~:text=EnableCloudwatchLogsExports.member.N
            ...this._config.isHA ? { performanceInsightsEnabled: true, performanceInsightsRetentionPeriod: 7 } : {},
            monitoringInterval: 60,
            monitoringRoleArn: monitoringRole.arn,
            applyImmediately: true,

            tags: {
                ...NfraConfig.tags,
                Name: instanceName
            }
        }, { dependsOn: monitoringRole, ignoreChanges: ["engineVersion"] });

        return {
            instanceIdentifier: dbInstance.identifier,
            host: dbInstance.endpoint.apply(t => t.split(":").takeFirst()),
            port: mariaDbPort,
            databaseName: dbInstance.dbName,
            username: dbInstance.username,
            password: dbInstance.password as Pulumi.Output<string>
        };
    }

    private _createPassword(): Pulumi.Output<string>
    {
        const password = new Random.RandomPassword(`${this._name}-rpass`, {
            length: 16,
            special: true,
            overrideSpecial: `_`
        });

        return password.result;
    }
}