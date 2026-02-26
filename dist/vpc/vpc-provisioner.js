import { given } from "@nivinjoseph/n-defensive";
// import { Mesh } from "@pulumi/aws/appmesh";
import * as aws from "@pulumi/aws";
// import { LogGroup } from "@pulumi/aws/cloudwatch";
// import { DefaultSecurityGroup, FlowLog } from "@pulumi/aws/ec2";
// import { Role, RolePolicy } from "@pulumi/aws/iam";
// import { PrivateDnsNamespace } from "@pulumi/aws/servicediscovery";
// import * as awsx from "@pulumi/awsx";
import { EnvType } from "../common/env-type.js";
import { NfraConfig } from "../common/nfra-config.js";
import { VpcDetails } from "./vpc-details.js";
// import * as Pulumi from "@pulumi/pulumi";
import { SubnetHelper } from "./subnet-helper.js";
import { VpcSubnetType } from "./vpc-subnet-type.js";
import { VpcAz } from "./vpc-az.js";
export class VpcProvisioner {
    constructor(name, config) {
        var _a, _b;
        this._vpcName = null;
        this._vpc = null;
        this._igw = null;
        this._subnets = new Array();
        this._ngws = new Map();
        this._pvtDnsName = null;
        this._pvtDnsNsp = null;
        // TODO: name prefixing must be parameterized
        // name = CommonHelper.prefixName(name);   
        given(name, "name").ensure(t => t.length <= 20, "name is too long");
        this._name = name;
        given(config, "config").ensureHasValue()
            .ensureHasStructure({
            // cidr16Bits: "string",
            cidrRange: "string",
            "enableVpcFlowLogs?": "boolean",
            subnets: [{
                    name: "string",
                    type: "string",
                    cidrRange: "string",
                    az: "string"
                }],
            "numNatGateways?": "number"
        })
            .ensure(t => SubnetHelper.validateCidrRange(t.cidrRange), "invalid cidrRange")
            .ensure(t => t.subnets.distinct(u => u.name).length === t.subnets.length, "subnet name must be unique")
            .ensure(t => t.subnets.distinct(u => u.cidrRange).length === t.subnets.length, "subnet cidrRange must be unique")
            .ensure(t => t.subnets.every(u => ["public", "private", "isolated"].some(v => u.prefix.contains(v))), "subnet prefixes must have words public, private or isolated in them")
            .ensure(t => t.subnets.every(u => u.name.startsWith(u.prefix)), "subnet names must start with the subnet's prefix")
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            .ensure(t => t.numNatGateways == null || t.numNatGateways === 1 || t.numNatGateways === 3, "numNatGateways must be 1 or 3");
        (_a = config.enableVpcFlowLogs) !== null && _a !== void 0 ? _a : (config.enableVpcFlowLogs = false);
        (_b = config.numNatGateways) !== null && _b !== void 0 ? _b : (config.numNatGateways = NfraConfig.env === EnvType.prod ? 3 : 1);
        this._config = config;
    }
    provision() {
        let vpcName = this._name;
        const suffix = "vpc";
        if (!vpcName.endsWith(suffix))
            vpcName = `${vpcName}-${suffix}`;
        this._vpcName = vpcName;
        this._vpc = new aws.ec2.Vpc(vpcName, {
            cidrBlock: this._config.cidrRange,
            enableDnsHostnames: true,
            enableDnsSupport: true,
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: vpcName })
        });
        const igwName = `${vpcName}-igw`;
        this._igw = new aws.ec2.InternetGateway(igwName, {
            vpcId: this._vpc.id,
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: igwName })
        }, { parent: this._vpc, dependsOn: [this._vpc] });
        this._subnets.push(...this._config.subnets
            .where(t => t.type === VpcSubnetType.public)
            .map(t => this._createSubnet(t)));
        this._subnets.push(...this._config.subnets
            .where(t => t.type === VpcSubnetType.private)
            .map(t => this._createSubnet(t)));
        this._subnets.push(...this._config.subnets
            .where(t => t.type === VpcSubnetType.isolated)
            .map(t => this._createSubnet(t)));
        this._createDefaultSecurityGroup();
        if (this._config.enableVpcFlowLogs)
            this._provisionVpcFlowLogs(vpcName);
        // this._createServiceMesh();
        this._createPrivateDnsNamespace();
        this._createVpcS3GatewayEndpoint();
        return new VpcDetails(this._vpc, this._pvtDnsName, this._pvtDnsNsp, this._subnets);
    }
    _createSubnet(subnetConfig) {
        const { name, type, cidrRange, az, prefix } = subnetConfig;
        given(name, "name").ensureHasValue().ensureIsString();
        given(type, "type").ensureHasValue().ensureIsEnum(VpcSubnetType);
        given(cidrRange, "cidrRange").ensureHasValue().ensureIsString()
            .ensure(t => SubnetHelper.validateCidrRange(t));
        given(az, "az").ensureHasValue().ensureIsEnum(VpcAz)
            .ensure(t => NfraConfig.awsRegionAzs.contains(t), "must be a valid AZ for the region");
        const subnet = new aws.ec2.Subnet(name, {
            vpcId: this._vpc.id,
            cidrBlock: cidrRange,
            availabilityZone: NfraConfig.awsRegion + az,
            mapPublicIpOnLaunch: type === VpcSubnetType.public,
            assignIpv6AddressOnCreation: false,
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: name, Prefix: prefix, SubnetType: type })
        });
        const routeTableName = `${name}-rt`;
        const routeTable = new aws.ec2.RouteTable(routeTableName, {
            vpcId: this._vpc.id,
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: routeTableName, SubnetType: type }),
        }, { parent: subnet, dependsOn: [subnet] });
        new aws.ec2.RouteTableAssociation(`${name}-rta`, {
            routeTableId: routeTable.id,
            subnetId: subnet.id
        }, { parent: routeTable, dependsOn: [routeTable] });
        if (type === VpcSubnetType.public) {
            new aws.ec2.Route(`${name}-rtr-igw`, {
                routeTableId: routeTable.id,
                gatewayId: this._igw.id,
                destinationCidrBlock: "0.0.0.0/0",
            }, { parent: routeTable, dependsOn: [routeTable] });
            if (this._config.numNatGateways === 1) {
                if (this._ngws.size === 0)
                    this._createNatGateway(subnet, az);
            }
            else // numNatGateways === 3
             {
                if (this._ngws.size !== 3 && !this._ngws.has(az))
                    this._createNatGateway(subnet, az);
            }
        }
        if (type === VpcSubnetType.private) {
            const natGateway = this._config.numNatGateways === 1
                ? [...this._ngws.values()][0] : this._ngws.get(az);
            new aws.ec2.Route(`${name}-rtr-ngw`, {
                routeTableId: routeTable.id,
                natGatewayId: natGateway.id,
                destinationCidrBlock: "0.0.0.0/0",
            }, { parent: routeTable, dependsOn: [routeTable] });
        }
        return Object.assign({ id: subnet.id, arn: subnet.arn, routeTableId: routeTable.id }, subnetConfig);
    }
    _createNatGateway(subnet, az) {
        const eipName = `${this._vpcName}-eip-${az}`;
        const eip = new aws.ec2.Eip(eipName, {
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: eipName }),
        }, { parent: subnet, dependsOn: [subnet] });
        const ngwName = `${this._vpcName}-ngw-${az}`;
        const ngw = new aws.ec2.NatGateway(ngwName, {
            subnetId: subnet.id,
            allocationId: eip.allocationId,
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: ngwName }),
        }, { parent: subnet, dependsOn: [subnet] });
        this._ngws.set(az, ngw);
    }
    _createDefaultSecurityGroup() {
        // denying all traffic on the default security group for aws security hub compliance
        const defaultSgName = `${this._name}-default-sg`;
        new aws.ec2.DefaultSecurityGroup(defaultSgName, {
            vpcId: this._vpc.id,
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: defaultSgName })
        });
    }
    _provisionVpcFlowLogs(vpcName) {
        const logRoleName = `${vpcName}-lr`;
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
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: logRoleName })
        });
        const logRolePolicyName = `${vpcName}-lrp`;
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
        const logGroupName = `${vpcName}-lg`;
        const logGroup = new aws.cloudwatch.LogGroup(logGroupName, {
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: logGroupName })
        });
        const flowLogName = `${vpcName}-fl`;
        new aws.ec2.FlowLog(flowLogName, {
            iamRoleArn: logRole.arn,
            logDestination: logGroup.arn,
            trafficType: "ALL",
            vpcId: this._vpc.id,
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: flowLogName })
        });
    }
    _createPrivateDnsNamespace() {
        const pvtDnsNspName = `${this._name}-pdn`;
        const prefix = `${NfraConfig.project}-${NfraConfig.env}-`;
        this._pvtDnsName = `${this._name.replace(prefix, "")}.${NfraConfig.env}.${NfraConfig.project}`;
        this._pvtDnsNsp = new aws.servicediscovery.PrivateDnsNamespace(pvtDnsNspName, {
            name: this._pvtDnsName,
            vpc: this._vpc.id,
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: pvtDnsNspName })
        });
    }
    _createVpcS3GatewayEndpoint() {
        const gatewayEndpointName = `${this._name}-s3-ep`;
        new aws.ec2.VpcEndpoint(gatewayEndpointName, {
            vpcId: this._vpc.id,
            serviceName: `com.amazonaws.${NfraConfig.awsRegion}.s3`,
            routeTableIds: this._subnets.map(t => t.routeTableId),
            vpcEndpointType: "Gateway",
            autoAccept: true,
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: gatewayEndpointName })
        });
    }
}
//# sourceMappingURL=vpc-provisioner.js.map