"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VpcProvisioner = void 0;
const n_defensive_1 = require("@nivinjoseph/n-defensive");
const n_exception_1 = require("@nivinjoseph/n-exception");
const appmesh_1 = require("@pulumi/aws/appmesh");
const cloudwatch_1 = require("@pulumi/aws/cloudwatch");
const ec2_1 = require("@pulumi/aws/ec2");
const iam_1 = require("@pulumi/aws/iam");
const servicediscovery_1 = require("@pulumi/aws/servicediscovery");
const ec2_2 = require("@pulumi/awsx/ec2");
const env_type_1 = require("../env-type");
const infra_config_1 = require("../infra-config");
const vpc_az_1 = require("./vpc-az");
class VpcProvisioner {
    get vpc() {
        (0, n_defensive_1.given)(this, "this").ensure(t => t._vpc != null, "not provisioned");
        return this._vpc;
    }
    get serviceMesh() {
        (0, n_defensive_1.given)(this, "this").ensure(t => t._serviceMesh != null, "not provisioned");
        return this._serviceMesh;
    }
    get privateDnsNamespace() {
        (0, n_defensive_1.given)(this, "this").ensure(t => t._pvtDnsNsp != null, "not provisioned");
        return this._pvtDnsNsp;
    }
    constructor(name, enableVpcFlowLogs = false) {
        this._vpc = null;
        this._serviceMesh = null;
        this._pvtDnsNsp = null;
        (0, n_defensive_1.given)(name, "name").ensureHasValue().ensureIsString();
        name = name.trim();
        if (!name.endsWith("-vpc"))
            name += "-vpc";
        (0, n_defensive_1.given)(name, "name").ensure(t => t.length <= 25, "name is too long");
        this._name = name;
        (0, n_defensive_1.given)(enableVpcFlowLogs, "enableVpcFlowLogs").ensureHasValue().ensureIsBoolean();
        this._enableVpcFlowLogs = enableVpcFlowLogs;
        this._cidrNet = this._calculateCidrNet();
    }
    provision() {
        this._vpc = new ec2_2.Vpc(this._name, {
            cidrBlock: `${this._cidrNet}.0.0/16`,
            numberOfAvailabilityZones: 3,
            numberOfNatGateways: infra_config_1.InfraConfig.env === env_type_1.EnvType.prod ? 3 : 1,
            enableDnsHostnames: true,
            enableDnsSupport: true,
            subnets: this.defineSubnets(),
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: this._name })
        });
        // denying all traffic on the default security group for aws security hub compliance
        const defaultSgName = `${this._name}-default-sg`;
        (0, n_defensive_1.given)(defaultSgName, "defaultSgName").ensure(t => t.length <= 25);
        new ec2_1.DefaultSecurityGroup(defaultSgName, {
            vpcId: this.vpc.id,
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: defaultSgName })
        });
        if (this._enableVpcFlowLogs)
            this._provisionVpcFlowLogs();
        const meshName = `${this._name}-sm`;
        this._serviceMesh = new appmesh_1.Mesh(meshName, {
            name: meshName,
            spec: {
                egressFilter: {
                    // type: "DROP_ALL"
                    type: "ALLOW_ALL"
                }
            },
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: meshName })
        });
        const pvtDnsNspName = `${this._name}-pdn`;
        this._pvtDnsNsp = new servicediscovery_1.PrivateDnsNamespace(pvtDnsNspName, {
            name: `${this._name.substring(0, this._name.length - 4)}.${infra_config_1.InfraConfig.env}`,
            vpc: this._vpc.id,
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: pvtDnsNspName })
        });
    }
    createSubnet(name, type, cidrNumber, az) {
        (0, n_defensive_1.given)(name, "name").ensureHasValue().ensureIsString().ensure(t => t.length <= 25, "name is too long");
        name = name.trim();
        (0, n_defensive_1.given)(type, "type").ensureHasValue().ensureIsString().ensure(t => ["public", "private", "isolated"].contains(t));
        (0, n_defensive_1.given)(cidrNumber, "cidrNumber").ensureHasValue().ensureIsNumber().ensure(t => t > 0 && t < 251);
        (0, n_defensive_1.given)(az, "az").ensureHasValue().ensureIsEnum(vpc_az_1.VpcAz);
        return {
            name,
            type,
            location: {
                cidrBlock: `${this._cidrNet}.${cidrNumber}.0/24`,
                availabilityZone: infra_config_1.InfraConfig.awsRegion + az
            },
            mapPublicIpOnLaunch: false,
            assignIpv6AddressOnCreation: false,
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: name })
        };
    }
    _calculateCidrNet() {
        let cidrMod = "";
        switch (infra_config_1.InfraConfig.env) {
            case env_type_1.EnvType.stage:
                cidrMod = "2";
                break;
            case env_type_1.EnvType.prod:
                cidrMod = "102";
                break;
            default:
                throw new n_exception_1.ApplicationException("VPC is only allowed for stage and prod envs");
        }
        return `10.${cidrMod}`;
    }
    _provisionVpcFlowLogs() {
        const logGroupName = `${this._name}-lg`;
        (0, n_defensive_1.given)(logGroupName, "logGroupName").ensure(t => t.length <= 25, "name is too long");
        const logGroup = new cloudwatch_1.LogGroup(logGroupName, {
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: logGroupName })
        });
        const logRoleName = `${this._name}-lr`;
        (0, n_defensive_1.given)(logRoleName, "logRoleName").ensure(t => t.length <= 25, "name is too long");
        const logRole = new iam_1.Role(logRoleName, {
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
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: logRoleName })
        });
        const logRolePolicyName = `${this._name}-lrp`;
        (0, n_defensive_1.given)(logRolePolicyName, "logRolePolicyName").ensure(t => t.length <= 25, "name is too long");
        new iam_1.RolePolicy(logRolePolicyName, {
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
        (0, n_defensive_1.given)(flowLogName, "flowLogName").ensure(t => t.length <= 25, "name is too long");
        new ec2_1.FlowLog(flowLogName, {
            iamRoleArn: logRole.arn,
            logDestination: logGroup.arn,
            trafficType: "ALL",
            vpcId: this.vpc.id,
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: flowLogName })
        });
    }
}
exports.VpcProvisioner = VpcProvisioner;
//# sourceMappingURL=vpc-provisioner.js.map