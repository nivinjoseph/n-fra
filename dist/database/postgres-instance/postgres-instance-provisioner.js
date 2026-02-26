import { given } from "@nivinjoseph/n-defensive";
import { NfraConfig } from "../../common/nfra-config.js";
import * as aws from "@pulumi/aws";
import * as Random from "@pulumi/random";
import { SecurityGroupHelper } from "../../vpc/security-group-helper.js";
export class PostgresInstanceProvisioner {
    constructor(name, config) {
        var _a;
        // this._name = CommonHelper.prefixName(name);
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
        given(config, "config").ensureHasValue().ensureIsObject()
            .ensureHasStructure({
            vpcDetails: "object",
            subnetNamePrefix: "string",
            ingressSubnetNamePrefixes: ["string"],
            "engineVersion?": "number",
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
            .ensureWhen(config.engineVersion != null, (t) => [12, 13, 16].contains(t.engineVersion), "engine version must be 12, 13 or 16")
            .ensure(t => !(t.databaseName == null && t.restoreSnapshotId == null), "must provide one of databaseName or restoreSnapshotId")
            .ensure(t => !(t.databaseName != null && t.restoreSnapshotId != null), "must provide only one of databaseName or restoreSnapshotId")
            .ensure(t => t.storageGb > 0 && t.storageGb <= t.maxStorageGb, "storageGb must be > 0 and <= maxStorageGb")
            .ensureWhen(config.provisionedIops != null, (t) => t.provisionedIops > 0, "provisionedIops must be > 0");
        (_a = config.engineVersion) !== null && _a !== void 0 ? _a : (config.engineVersion = 16);
        this._config = config;
    }
    provision() {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const postgresDbPort = 5432;
        const serviceSubnets = this._config.vpcDetails
            .resolveSubnets([this._config.subnetNamePrefix])
            .map(u => u.id);
        // .apply(t => t.map(u => u.id));
        const subnetGroupName = `${this._name}-postgres-subnet-grp`;
        const subnetGroup = new aws.rds.SubnetGroup(subnetGroupName, {
            subnetIds: serviceSubnets,
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: subnetGroupName })
        });
        const ingressCidrBlocks = SecurityGroupHelper.resolveCidrBlocks(this._config.vpcDetails, this._config.ingressSubnetNamePrefixes);
        // const ingressCidrBlocks = this._config.vpcDetails
        //     .resolveSubnets(this._config.ingressSubnetNamePrefixes)
        //     .apply(subnets => subnets.map(u => u.cidrBlock));
        const secGroupName = `${this._name}-postgres-sg`;
        const secGroup = new aws.ec2.SecurityGroup(secGroupName, {
            vpcId: this._config.vpcDetails.vpc.id,
            revokeRulesOnDelete: true,
            ingress: [{
                    protocol: "tcp",
                    fromPort: postgresDbPort,
                    toPort: postgresDbPort,
                    cidrBlocks: ingressCidrBlocks
                }],
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: secGroupName })
        }, {
        // replaceOnChanges: ["*"]
        });
        const username = (_a = this._config.username) !== null && _a !== void 0 ? _a : "appuser";
        const monitoringAssumeRolePolicyDocument = {
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
        const monitoringRoleName = `${this._name}-postgres-mon-rle`;
        const monitoringRole = new aws.iam.Role(monitoringRoleName, {
            assumeRolePolicy: monitoringAssumeRolePolicyDocument,
            managedPolicyArns: ["arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"],
            forceDetachPolicies: true,
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: monitoringRoleName })
        });
        let engineVersion = "12.19";
        let parameterGroupName = "default.postgres12";
        let optionGroupName = "default:postgres-12";
        if (this._config.engineVersion === 13) {
            engineVersion = "13.18";
            parameterGroupName = "default.postgres13";
            optionGroupName = "default:postgres-13";
        }
        else if (this._config.engineVersion === 16) {
            engineVersion = "16.6";
            // parameterGroupName = "default.postgres16";
            optionGroupName = "default:postgres-16";
            const paramGroupName = `${this._name}-postgres-param-grp`;
            const paramGroup = new aws.rds.ParameterGroup(paramGroupName, {
                family: "postgres16",
                parameters: [{
                        name: "rds.force_ssl",
                        value: "0",
                        applyMethod: "immediate"
                    }],
                tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: paramGroupName })
            });
            parameterGroupName = paramGroup.name;
        }
        const instanceName = `${this._name}-postgres-db-ins`;
        const dbInstance = new aws.rds.Instance(instanceName, {
            dbName: (_b = this._config.databaseName) !== null && _b !== void 0 ? _b : undefined,
            snapshotIdentifier: (_c = this._config.restoreSnapshotId) !== null && _c !== void 0 ? _c : undefined,
            username,
            password: (_d = this._config.password) !== null && _d !== void 0 ? _d : this._createPassword(),
            iamDatabaseAuthenticationEnabled: false,
            engine: "postgres",
            engineVersion,
            parameterGroupName,
            optionGroupName,
            licenseModel: "postgresql-license",
            instanceClass: this._config.instanceClass,
            storageType: this._config.provisionedIops != null ? "io2" : "gp2",
            iops: (_e = this._config.provisionedIops) !== null && _e !== void 0 ? _e : undefined,
            dedicatedLogVolume: this._config.provisionedIops != null
                ? this._config.enableDedicatedLogVolumeForProvisionedIops
                : undefined,
            allocatedStorage: this._config.storageGb,
            maxAllocatedStorage: this._config.maxStorageGb,
            storageEncrypted: (_f = this._config.storageEncrypted) !== null && _f !== void 0 ? _f : false,
            // storageEncrypted: true,
            port: postgresDbPort,
            availabilityZone: this._config.isHA ? undefined : (_g = this._config.availabilityZone) !== null && _g !== void 0 ? _g : NfraConfig.awsRegionAvailabilityZones.takeFirst(),
            multiAz: this._config.isHA,
            dbSubnetGroupName: subnetGroup.name,
            vpcSecurityGroupIds: [secGroup.id],
            publiclyAccessible: false,
            backupRetentionPeriod: 7,
            deleteAutomatedBackups: true,
            deletionProtection: (_h = this._config.deletionProtection) !== null && _h !== void 0 ? _h : false,
            skipFinalSnapshot: true,
            allowMajorVersionUpgrade: false,
            autoMinorVersionUpgrade: true,
            enabledCloudwatchLogsExports: ["postgresql", "upgrade"], // https://docs.aws.amazon.com/AmazonRDS/latest/APIReference/API_CreateDBInstance.html#:~:text=EnableCloudwatchLogsExports.member.N
            performanceInsightsEnabled: true,
            performanceInsightsRetentionPeriod: 7,
            monitoringInterval: 60,
            monitoringRoleArn: monitoringRole.arn,
            applyImmediately: true,
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: instanceName })
        }, { dependsOn: monitoringRole, ignoreChanges: ["engineVersion"] });
        return {
            instanceIdentifier: dbInstance.identifier,
            host: dbInstance.endpoint.apply(t => t.split(":").takeFirst()),
            port: postgresDbPort,
            databaseName: dbInstance.dbName,
            username: dbInstance.username,
            password: dbInstance.password
        };
    }
    _createPassword() {
        const password = new Random.RandomPassword(`${this._name}-rpass`, {
            length: 16,
            special: true,
            overrideSpecial: `_`
        });
        return password.result;
    }
}
//# sourceMappingURL=postgres-instance-provisioner.js.map