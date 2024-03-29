"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VpcProvisioner = void 0;
const n_defensive_1 = require("@nivinjoseph/n-defensive");
const n_util_1 = require("@nivinjoseph/n-util");
// import { Mesh } from "@pulumi/aws/appmesh";
const aws = require("@pulumi/aws");
// import { LogGroup } from "@pulumi/aws/cloudwatch";
// import { DefaultSecurityGroup, FlowLog } from "@pulumi/aws/ec2";
// import { Role, RolePolicy } from "@pulumi/aws/iam";
// import { PrivateDnsNamespace } from "@pulumi/aws/servicediscovery";
// import { VpcSubnetArgs, VpcSubnetType, Vpc } from "@pulumi/awsx/ec2";
const awsx = require("@pulumi/awsx");
const env_type_1 = require("../env-type");
const nfra_config_1 = require("../nfra-config");
const vpc_az_1 = require("./vpc-az");
class VpcProvisioner {
    constructor(name, config) {
        var _a, _b;
        this._vpc = null;
        this._serviceMesh = null;
        this._pvtDnsNsp = null;
        (0, n_defensive_1.given)(name, "name").ensureHasValue().ensureIsString();
        name = name.trim();
        if (!name.endsWith("-vpc"))
            name += "-vpc";
        (0, n_defensive_1.given)(name, "name").ensure(t => t.length <= 25, "name is too long");
        this._name = name;
        (0, n_defensive_1.given)(config, "config").ensureHasValue()
            .ensureHasStructure({
            cidr16Bits: "string",
            "enableVpcFlowLogs?": "boolean",
            subnets: [{
                    name: "string",
                    type: "string",
                    cidrOctet3: "number",
                    az: "string"
                }],
            "numNatGateways?": "number"
        })
            .ensure(t => t.subnets.distinct(u => u.name).length === t.subnets.length, "subnet name must be unique")
            .ensure(t => t.subnets.distinct(u => u.cidrOctet3).length === t.subnets.length, "subnet cidrOctet3 must be unique")
            .ensure(t => t.numNatGateways == null || (t.numNatGateways >= 1 && t.numNatGateways <= 3), "numNatGateways must be between 1 and 3");
        const { cidr16Bits } = config;
        (0, n_defensive_1.given)(cidr16Bits, "config.cidr16Bits")
            .ensure(t => t.split(".").length === 2, "provide only the first 2 octets")
            .ensure(t => t.split(".").takeFirst() === "10", "first octet must be 10")
            .ensure(t => t.split(".").takeLast().length <= 3, "second octet must be a valid ipv4 octet")
            .ensure(t => {
            const secondOctet = n_util_1.TypeHelper.parseNumber(t.split(".").takeLast());
            return secondOctet != null && secondOctet > 0 && secondOctet <= 250;
        }, "second octet must be a valid number between 1 and 250 inclusive");
        (_a = config.enableVpcFlowLogs) !== null && _a !== void 0 ? _a : (config.enableVpcFlowLogs = false);
        (_b = config.numNatGateways) !== null && _b !== void 0 ? _b : (config.numNatGateways = nfra_config_1.NfraConfig.env === env_type_1.EnvType.prod ? 3 : 1);
        this._config = config;
    }
    provision() {
        this._vpc = new awsx.ec2.Vpc(this._name, {
            cidrBlock: `${this._config.cidr16Bits}.0.0/16`,
            numberOfAvailabilityZones: 3,
            numberOfNatGateways: this._config.numNatGateways,
            enableDnsHostnames: true,
            enableDnsSupport: true,
            subnets: this._config.subnets.map(t => this._createSubnet(t.name, t.type, t.cidrOctet3, t.az)),
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: this._name })
        });
        // denying all traffic on the default security group for aws security hub compliance
        const defaultSgName = `${this._name}-default-sg`;
        new aws.ec2.DefaultSecurityGroup(defaultSgName, {
            vpcId: this._vpc.id,
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: defaultSgName })
        });
        if (this._config.enableVpcFlowLogs)
            this._provisionVpcFlowLogs();
        const meshName = `${this._name}-${nfra_config_1.NfraConfig.env}-sm`;
        this._serviceMesh = new aws.appmesh.Mesh(meshName, {
            name: meshName,
            spec: {
                egressFilter: {
                    // type: "DROP_ALL"
                    type: "ALLOW_ALL"
                }
            },
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: meshName })
        });
        const pvtDnsNspName = `${this._name}-pdn`;
        const pvtDnsName = `${this._name.substring(0, this._name.length - 4)}.${nfra_config_1.NfraConfig.env}`;
        this._pvtDnsNsp = new aws.servicediscovery.PrivateDnsNamespace(pvtDnsNspName, {
            name: pvtDnsName,
            vpc: this._vpc.id,
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: pvtDnsNspName })
        });
        return {
            vpc: this._vpc,
            serviceMesh: this._serviceMesh,
            privateDnsNamespace: this._pvtDnsNsp,
            privateDnsDomain: pvtDnsName
        };
    }
    _createSubnet(name, type, cidrOctet3, az) {
        (0, n_defensive_1.given)(name, "name").ensureHasValue().ensureIsString();
        name = name.trim();
        (0, n_defensive_1.given)(type, "type").ensureHasValue().ensureIsString().ensure(t => ["public", "private", "isolated"].contains(t));
        (0, n_defensive_1.given)(cidrOctet3, "cidrOctet3").ensureHasValue().ensureIsNumber().ensure(t => t > 0 && t <= 250);
        (0, n_defensive_1.given)(az, "az").ensureHasValue().ensureIsEnum(vpc_az_1.VpcAz);
        return {
            name,
            type,
            location: {
                cidrBlock: `${this._config.cidr16Bits}.${cidrOctet3}.0/24`,
                availabilityZone: nfra_config_1.NfraConfig.awsRegion + az
            },
            mapPublicIpOnLaunch: false,
            assignIpv6AddressOnCreation: false,
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: name })
        };
    }
    _provisionVpcFlowLogs() {
        const logGroupName = `${this._name}-lg`;
        const logGroup = new aws.cloudwatch.LogGroup(logGroupName, {
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: logGroupName })
        });
        const logRoleName = `${this._name}-lr`;
        const logRole = new aws.iam.Role(logRoleName, {
            assumeRolePolicy: {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Sid": "",
                        "Effect": "Allow",
                        "Principal": {
                            "Service": "vpc-flow-logs.amazonaws.com"
                        },
                        "Action": "sts:AssumeRole"
                    }
                ]
            },
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: logRoleName })
        });
        const logRolePolicyName = `${this._name}-lrp`;
        new aws.iam.RolePolicy(logRolePolicyName, {
            role: logRole.id,
            policy: {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Action": [
                            "logs:CreateLogGroup",
                            "logs:CreateLogStream",
                            "logs:PutLogEvents",
                            "logs:DescribeLogGroups",
                            "logs:DescribeLogStreams"
                        ],
                        "Effect": "Allow",
                        "Resource": "*"
                    }
                ]
            }
        });
        const flowLogName = `${this._name}-fl`;
        new aws.ec2.FlowLog(flowLogName, {
            iamRoleArn: logRole.arn,
            logDestination: logGroup.arn,
            trafficType: "ALL",
            vpcId: this._vpc.id,
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: flowLogName })
        });
    }
}
exports.VpcProvisioner = VpcProvisioner;
//# sourceMappingURL=vpc-provisioner.js.map