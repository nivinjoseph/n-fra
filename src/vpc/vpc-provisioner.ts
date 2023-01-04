import { given } from "@nivinjoseph/n-defensive";
import { ApplicationException } from "@nivinjoseph/n-exception";
import { Tags } from "@pulumi/aws";
import { LogGroup } from "@pulumi/aws/cloudwatch";
import { DefaultSecurityGroup, FlowLog } from "@pulumi/aws/ec2";
import { Role, RolePolicy } from "@pulumi/aws/iam";
import { VpcSubnetArgs, VpcSubnetType, Vpc } from "@pulumi/awsx/ec2";
import { EnvType } from "../env-type";
import { InfraConfig } from "../infra-config";
import { VpcAz } from "./vpc-az";


export abstract class VpcProvisioner
{
    private readonly _name: string;
    private readonly _enableVpcFlowLogs: boolean;
    private readonly _tags: Tags;
    private readonly _region: string;
    private readonly _cidrNet: string;
    private _vpc: Vpc | null = null;
    
    
    public get vpc(): Vpc
    {
        given(this, "this").ensure(t => t._vpc != null, "not provisioned");
        return this._vpc!;
    }
    
    
    protected constructor(name: string, enableVpcFlowLogs = false)
    {
        given(name, "name").ensureHasValue().ensureIsString();
        name = name.trim();
        if (!name.endsWith("-vpc"))
            name += "-vpc";
        
        given(name, "name").ensure(t => t.length <= 25, "name is too long");
        this._name = name;
        
        given(enableVpcFlowLogs, "enableVpcFlowLogs").ensureHasValue().ensureIsBoolean();
        this._enableVpcFlowLogs = enableVpcFlowLogs;
        
        this._tags = InfraConfig.tags;
        this._region = InfraConfig.awsRegion;
        
        this._cidrNet = this._calculateCidrNet();
    }
    
    
    public provision(): void
    {
        this._vpc = new Vpc(this._name, {
            cidrBlock: `${this._cidrNet}.0.0/16`,
            numberOfAvailabilityZones: 3,
            numberOfNatGateways: InfraConfig.env === EnvType.prod ? 3 : 1,
            enableDnsHostnames: true,
            enableDnsSupport: true,
            subnets: this.defineSubnets(),
            tags: {
                ...this._tags,
                Name: this._name
            }
        });
        
        // denying all traffic on the default security group for aws security hub compliance
        const defaultSgName = `${this._name}-default-sg`;
        given(defaultSgName, "defaultSgName").ensure(t => t.length <= 25);
        new DefaultSecurityGroup(defaultSgName, {
            vpcId: this.vpc.id,
            tags: {
                Name: defaultSgName,
                ...this._tags
            }
        });
        
        if (this._enableVpcFlowLogs)
            this._provisionVpcFlowLogs();
    }
    
    /**
     * @summary keep this implementation idempotent
     */
    protected abstract defineSubnets(): Array<VpcSubnetArgs>;
    
    protected createSubnet(name: string, type: VpcSubnetType, cidrNumber: number, az: VpcAz): VpcSubnetArgs
    {
        given(name, "name").ensureHasValue().ensureIsString().ensure(t => t.length <= 25, "name is too long");
        name = name.trim();
        
        given(type, "type").ensureHasValue().ensureIsString().ensure(t => ["public", "private", "isolated"].contains(t));
        
        given(cidrNumber, "cidrNumber").ensureHasValue().ensureIsNumber().ensure(t => t > 0 && t < 251);
        
        given(az, "az").ensureHasValue().ensureIsEnum(VpcAz);
        
        return {
            name,
            type,
            location: {
                cidrBlock: `${this._cidrNet}.${cidrNumber}.0/24`,
                availabilityZone: this._region + az
            },
            mapPublicIpOnLaunch: false,
            assignIpv6AddressOnCreation: false,
            tags: {
                Name: name,
                ...this._tags
            }
        };
    }
    
    private _calculateCidrNet(): string
    {
        let cidrMod = "";
        switch (InfraConfig.env)
        {
            case EnvType.stage:
                cidrMod = "2";
                break;
            case EnvType.prod:
                cidrMod = "102";
                break;
            default:
                throw new ApplicationException("VPC is only allowed for stage and prod envs");
        }

        return `10.${cidrMod}`;
    }
    
    private _provisionVpcFlowLogs(): void
    {
        const logGroupName = `${this._name}-lg`;
        given(logGroupName, "logGroupName").ensure(t => t.length <= 25, "name is too long");
        const logGroup = new LogGroup(logGroupName, {
            tags: {
                Name: logGroupName,
                ...this._tags
            }
        });
        
        const logRoleName = `${this._name}-lr`;
        given(logRoleName, "logRoleName").ensure(t => t.length <= 25, "name is too long");
        const logRole = new Role(logRoleName, {
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
                Name: logRoleName,
                ...this._tags
            }
        });
        
        const logRolePolicyName = `${this._name}-lrp`;
        given(logRolePolicyName, "logRolePolicyName").ensure(t => t.length <= 25, "name is too long");
        new RolePolicy(logRolePolicyName, {
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
        given(flowLogName, "flowLogName").ensure(t => t.length <= 25, "name is too long");
        new FlowLog(flowLogName, {
            iamRoleArn: logRole.arn,
            logDestination: logGroup.arn,
            trafficType: "ALL",
            vpcId: this.vpc.id,
            tags: {
                Name: flowLogName,
                ...this._tags
            }
        });
    }
}