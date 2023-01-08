import { given } from "@nivinjoseph/n-defensive";
import { ApplicationException } from "@nivinjoseph/n-exception";
import { Mesh } from "@pulumi/aws/appmesh";
import { LogGroup } from "@pulumi/aws/cloudwatch";
import { DefaultSecurityGroup, FlowLog } from "@pulumi/aws/ec2";
import { Role, RolePolicy } from "@pulumi/aws/iam";
import { PrivateDnsNamespace } from "@pulumi/aws/servicediscovery";
import { VpcSubnetArgs, VpcSubnetType, Vpc } from "@pulumi/awsx/ec2";
import { EnvType } from "../env-type";
import { InfraConfig } from "../infra-config";
import { VpcAz } from "./vpc-az";
import { VpcInfo } from "./vpc-info";


export abstract class VpcProvisioner implements VpcInfo
{
    private readonly _name: string;
    private readonly _enableVpcFlowLogs: boolean;
    private readonly _cidrNet: string;
    private _vpc: Vpc | null = null;
    private _serviceMesh: Mesh | null = null;
    private _pvtDnsNsp: PrivateDnsNamespace | null = null;
    
    
    public get vpc(): Vpc
    {
        given(this, "this").ensure(t => t._vpc != null, "not provisioned");
        return this._vpc!;
    }
    
    public get serviceMesh(): Mesh 
    {
        given(this, "this").ensure(t => t._serviceMesh != null, "not provisioned");
        return this._serviceMesh!;
    }
    
    public get privateDnsNamespace(): PrivateDnsNamespace
    {
        given(this, "this").ensure(t => t._pvtDnsNsp != null, "not provisioned");
        return this._pvtDnsNsp!;
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
                ...InfraConfig.tags,
                Name: this._name
            }
        });
        
        // denying all traffic on the default security group for aws security hub compliance
        const defaultSgName = `${this._name}-default-sg`;
        given(defaultSgName, "defaultSgName").ensure(t => t.length <= 25);
        new DefaultSecurityGroup(defaultSgName, {
            vpcId: this.vpc.id,
            tags: {
                ...InfraConfig.tags,
                Name: defaultSgName
            }
        });
        
        if (this._enableVpcFlowLogs)
            this._provisionVpcFlowLogs();
            
        const meshName = `${this._name}-sm`;
        this._serviceMesh = new Mesh(meshName, {
            name: meshName,
            spec: {
                egressFilter: {
                    // type: "DROP_ALL"
                    type: "ALLOW_ALL"
                }
            },
            tags: {
                ...InfraConfig.tags,
                Name: meshName
            }
        });

        const pvtDnsNspName = `${this._name}-pdn`;
        this._pvtDnsNsp = new PrivateDnsNamespace(pvtDnsNspName, {
            name: `${this._name.substring(0, this._name.length - 4)}.${InfraConfig.env}`,
            vpc: this._vpc.id,
            tags: {
                ...InfraConfig.tags,
                Name: pvtDnsNspName
            }
        });
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
                availabilityZone: InfraConfig.awsRegion + az
            },
            mapPublicIpOnLaunch: false,
            assignIpv6AddressOnCreation: false,
            tags: {
                ...InfraConfig.tags,
                Name: name
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
                ...InfraConfig.tags,
                Name: logGroupName
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
                ...InfraConfig.tags,
                Name: logRoleName
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
                ...InfraConfig.tags,
                Name: flowLogName
            }
        });
    }
}