import { given } from "@nivinjoseph/n-defensive";
import { TypeHelper } from "@nivinjoseph/n-util";
// import { Mesh } from "@pulumi/aws/appmesh";
import * as aws from "@pulumi/aws";
// import { LogGroup } from "@pulumi/aws/cloudwatch";
// import { DefaultSecurityGroup, FlowLog } from "@pulumi/aws/ec2";
// import { Role, RolePolicy } from "@pulumi/aws/iam";
// import { PrivateDnsNamespace } from "@pulumi/aws/servicediscovery";
// import { VpcSubnetArgs, VpcSubnetType, Vpc } from "@pulumi/awsx/ec2";
import * as awsx from "@pulumi/awsx";
import { EnvType } from "../env-type.js";
import { NfraConfig } from "../nfra-config.js";
import { VpcAz } from "./vpc-az.js";
import { VpcConfig } from "./vpc-config.js";
import { VpcDetails } from "./vpc-details.js";


export class VpcProvisioner
{
    private readonly _name: string;
    private readonly _config: VpcConfig;
    private _vpc: awsx.ec2.Vpc | null = null;
    private _serviceMesh: aws.appmesh.Mesh | null = null;
    private _pvtDnsNsp: aws.servicediscovery.PrivateDnsNamespace | null = null;
    
    
    public constructor(name: string, config: VpcConfig)
    {
        given(name, "name").ensureHasValue().ensureIsString();
        name = name.trim();
        if (!name.endsWith("-vpc"))
            name += "-vpc";
        
        given(name, "name").ensure(t => t.length <= 25, "name is too long");
        this._name = name;
        
        given(config, "config").ensureHasValue()
            .ensureHasStructure({
                cidr16Bits: "string",
                "enableVpcFlowLogs?": "boolean",
                subnets: [{
                    name: "string",
                    type: "string",
                    cidrOctet3: "number",
                    az: "string"
                }]
            })
            .ensure(t => t.subnets.distinct(u => u.name).length === t.subnets.length, "subnet name must be unique")
            .ensure(t => t.subnets.distinct(u => u.cidrOctet3).length === t.subnets.length, "subnet cidrOctet3 must be unique");
        const { cidr16Bits } = config;
        given(cidr16Bits, "config.cidr16Bits")
            .ensure(t => t.split(".").length === 2, "provide only the first 2 octets")
            .ensure(t => t.split(".").takeFirst() === "10", "first octet must be 10")
            .ensure(t => t.split(".").takeLast().length <= 3, "second octet must be a valid ipv4 octet")
            .ensure(t =>
            {
                const secondOctet = TypeHelper.parseNumber(t.split(".").takeLast());
                return secondOctet != null && secondOctet > 0 && secondOctet <= 250;
                
            }, "second octet must be a valid number between 1 and 250 inclusive");
        config.enableVpcFlowLogs ??= false;
        this._config = config;
    }
    
    
    public provision(): VpcDetails
    {
        this._vpc = new awsx.ec2.Vpc(this._name, {
            cidrBlock: `${this._config.cidr16Bits}.0.0/16`,
            numberOfAvailabilityZones: 3,
            numberOfNatGateways: NfraConfig.env === EnvType.prod ? 3 : 1,
            enableDnsHostnames: true,
            enableDnsSupport: true,
            subnets: this._config.subnets.map(t => this._createSubnet(t.name, t.type, t.cidrOctet3, t.az)),
            tags: {
                ...NfraConfig.tags,
                Name: this._name
            }
        });
        
        // denying all traffic on the default security group for aws security hub compliance
        const defaultSgName = `${this._name}-default-sg`;
        new aws.ec2.DefaultSecurityGroup(defaultSgName, {
            vpcId: this._vpc.id,
            tags: {
                ...NfraConfig.tags,
                Name: defaultSgName
            }
        });
        
        if (this._config.enableVpcFlowLogs)
            this._provisionVpcFlowLogs();
            
        const meshName = `${this._name}-${NfraConfig.env}-sm`;
        this._serviceMesh = new aws.appmesh.Mesh(meshName, {
            name: meshName,
            spec: {
                egressFilter: {
                    // type: "DROP_ALL"
                    type: "ALLOW_ALL"
                }
            },
            tags: {
                ...NfraConfig.tags,
                Name: meshName
            }
        });

        const pvtDnsNspName = `${this._name}-pdn`;
        const pvtDnsName = `${this._name.substring(0, this._name.length - 4)}.${NfraConfig.env}`;
        this._pvtDnsNsp = new aws.servicediscovery.PrivateDnsNamespace(pvtDnsNspName, {
            name: pvtDnsName,
            vpc: this._vpc.id,
            tags: {
                ...NfraConfig.tags,
                Name: pvtDnsNspName
            }
        });
        
        return {
            vpc: this._vpc,
            serviceMesh: this._serviceMesh,
            privateDnsNamespace: this._pvtDnsNsp,
            privateDnsDomain: pvtDnsName
        };
    }
    
    private _createSubnet(name: string, type: awsx.ec2.VpcSubnetType, cidrOctet3: number, az: VpcAz): awsx.ec2.VpcSubnetArgs
    {
        given(name, "name").ensureHasValue().ensureIsString();
        name = name.trim();
        
        given(type, "type").ensureHasValue().ensureIsString().ensure(t => ["public", "private", "isolated"].contains(t));
        
        given(cidrOctet3, "cidrOctet3").ensureHasValue().ensureIsNumber().ensure(t => t > 0 && t <= 250);
        
        given(az, "az").ensureHasValue().ensureIsEnum(VpcAz);
        
        return {
            name,
            type,
            location: {
                cidrBlock: `${this._config.cidr16Bits}.${cidrOctet3}.0/24`,
                availabilityZone: NfraConfig.awsRegion + az
            },
            mapPublicIpOnLaunch: false,
            assignIpv6AddressOnCreation: false,
            tags: {
                ...NfraConfig.tags,
                Name: name
            }
        };
    }
    
    private _provisionVpcFlowLogs(): void
    {
        const logGroupName = `${this._name}-lg`;
        const logGroup = new aws.cloudwatch.LogGroup(logGroupName, {
            tags: {
                ...NfraConfig.tags,
                Name: logGroupName
            }
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
            tags: {
                ...NfraConfig.tags,
                Name: logRoleName
            }
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
            vpcId: this._vpc!.id,
            tags: {
                ...NfraConfig.tags,
                Name: flowLogName
            }
        });
    }
}