import { given } from "@nivinjoseph/n-defensive";
import { LambdaConfig } from "./lambda-config";
import { LambdaDetails } from "./lambda-details";
import * as aws from "@pulumi/aws";
import { NfraConfig } from "../nfra-config";
import * as Pulumi from "@pulumi/pulumi";
import { LambdaAccessConfig } from "./lambda-access-config";


export class LambdaProvisioner
{
    private readonly _name: string;
    private readonly _config: LambdaConfig;
    
    
    public constructor(name: string, config: LambdaConfig)
    {
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
        
        given(config, "config").ensureHasValue()
            .ensureHasStructure({
            codeZipFilePath: "string",
            memorySize: "number",
            "envVars?": ["object"],
            handler: "string",
            timeout: "number",
            "provisionedConcurrency?": "number",
            "vpcDetails?": "object",
            "subnetNamePrefix?": "string",
            "ingressSubnetNamePrefixes?": ["string"]
            })
            .ensureWhen(config.vpcDetails != null, t => t.subnetNamePrefix != null,
                "subnetNamePrefix is required when vpcDetails is provided")
            .ensureWhen(config.vpcDetails != null, t => t.ingressSubnetNamePrefixes != null && t.ingressSubnetNamePrefixes.isNotEmpty,
                "ingressSubnetNamePrefixes is required when vpcDetails is provided");
        this._config = config;
    }
    
    
    public static provisionAccess(name: string, config: LambdaAccessConfig): void
    {
        given(name, "name").ensureHasValue().ensureIsString();
        given(config, "config").ensureHasValue().ensureHasStructure({
            lambdaDetails: "object",
            userOrRoleArn: "object"
        }).ensure(t => !(t.userOrRoleArn == null && t.awsService == null) && !(t.userOrRoleArn != null && t.awsService != null),
            "only one of userOrRoleArn or awsService must be provided");
        
        new aws.lambda.Permission(`${name}-lam-per`, {
            action: "lambda:InvokeFunction",
            function: config.lambdaDetails.functionName,
            principal: config.userOrRoleArn ?? config.awsService!
        });
    }
    
    public provision(): LambdaDetails
    {
        const secGroupName = `${this._name}-sg`;
        const secGroup = this._config.vpcDetails != null
            ? new aws.ec2.SecurityGroup(secGroupName, {
                vpcId: this._config.vpcDetails.vpc.id,
                revokeRulesOnDelete: true,
                ingress: [
                    {
                        fromPort: 0,
                        toPort: 0,
                        protocol: "-1",
                        cidrBlocks: Pulumi.output(this._config.vpcDetails.vpc.getSubnets("private"))
                            .apply((subnets) =>
                                subnets.where(subnet =>
                                    this._config.ingressSubnetNamePrefixes!.some(prefix =>
                                        subnet.subnetName.startsWith(prefix)))
                                    .map(t => t.subnet.cidrBlock as Pulumi.Output<string>))
                    }
                ],
                egress: [{
                    fromPort: 0,
                    toPort: 0,
                    protocol: "-1",
                    cidrBlocks: ["0.0.0.0/0"],
                    ipv6CidrBlocks: ["::/0"]
                }],
                tags: {
                    ...NfraConfig.tags,
                    Name: secGroupName
                }
            }, {
                replaceOnChanges: ["*"]
            })
            : null;
        
        const lambdaRoleName = `${this._name}-lam-rol`;
        const lambdaRole = new aws.iam.Role(lambdaRoleName, {
            assumeRolePolicy: {
                Version: "2012-10-17",
                Statement: [{
                    Action: "sts:AssumeRole",
                    Principal: {
                        Service: "lambda.amazonaws.com"
                    },
                    Effect: "Allow"
                }]
            },
            managedPolicyArns: this._config.vpcDetails != null
                ? ["arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"]
                : ["arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"],
            tags: {
                ...NfraConfig.tags,
                Name: lambdaRoleName
            }
        });
        
        const lambdaName = `${this._name}-lam`;
        const lambda = new aws.lambda.Function(lambdaName, {
            packageType: "Zip",
            // layers: ["arn:aws:lambda:us-east-2:464622532012:layer:Datadog-Extension:29"], // instrumentation
            code: this._config.codeZipFilePath,
            runtime: aws.lambda.Runtime.NodeJS18dX,
            // handler: "node_modules/datadog-lambda-js/dist/handler.handler",
            // handler: "index.handler",
            handler: this._config.handler,
            memorySize: this._config.memorySize,
            timeout: this._config.timeout,
            role: lambdaRole.arn,
            environment: {
                variables: [
                    ...this._config.envVars != null ? this._config.envVars : []
                ].reverse().distinct(t => t.name).orderBy(t => t.name)
                    .map(t =>
                    {
                        if (typeof t.value === "string")
                            return { name: t.name, value: Pulumi.output(t.value) };
                        return t;
                    })
                    .reduce<Record<string, Pulumi.Output<string>>>((acc, t) =>
                    {
                        acc[t.name] = t.value as Pulumi.Output<string>;
                        return acc;
                    }, {})
            },
            vpcConfig: this._config.vpcDetails != null
                ? {
                    subnetIds: Pulumi.output(this._config.vpcDetails.vpc.getSubnets("private"))
                        .apply((subnets) => subnets.where(t => t.subnetName.startsWith(this._config.subnetNamePrefix!)).map(t => t.id)),
                    securityGroupIds: [secGroup!.id]
                }
                : undefined,
            tags: {
                ...NfraConfig.tags,
                Name: lambdaName
            }
        });
        
        if(this._config.provisionedConcurrency != null)
        {
            new aws.lambda.ProvisionedConcurrencyConfig(`${this._name}-lam-pcc`, {
                functionName: lambda.name,
                provisionedConcurrentExecutions: this._config.provisionedConcurrency,
                qualifier: lambda.version
            });
        }
        
        return {
            lambdaArn: lambda.arn,
            functionName: lambda.name
        };
    }
}