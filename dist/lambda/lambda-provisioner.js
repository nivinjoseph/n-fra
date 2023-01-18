"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LambdaProvisioner = void 0;
const n_defensive_1 = require("@nivinjoseph/n-defensive");
const aws = require("@pulumi/aws");
const nfra_config_1 = require("../nfra-config");
const Pulumi = require("@pulumi/pulumi");
const Fs = require("fs");
class LambdaProvisioner {
    constructor(name, config) {
        (0, n_defensive_1.given)(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
        (0, n_defensive_1.given)(config, "config").ensureHasValue()
            .ensureHasStructure({
            codeFilePath: "string",
            memorySize: "number",
            "envVars?": ["object"],
            handler: "string",
            timeout: "number",
            "provisionedConcurrency?": "number",
            "vpcDetails?": "object",
            "subnetNamePrefix?": "string",
            "ingressSubnetNamePrefixes?": ["string"]
        })
            // .tar, .tar.gz, or .zip
            .ensure(t => t.codeFilePath.startsWith("/"), "codeFilePath must absolute")
            .ensure(t => t.codeFilePath.endsWith(".tar") || t.codeFilePath.endsWith(".tar.gz") || t.codeFilePath.endsWith(".zip"), "codeFilePath must be a valid .tar, .tar.gz, or .zip file")
            .ensure(t => Fs.existsSync(t.codeFilePath), "codeFilePath does not exist")
            .ensureWhen(config.vpcDetails != null, t => t.subnetNamePrefix != null, "subnetNamePrefix is required when vpcDetails is provided")
            .ensureWhen(config.vpcDetails != null, t => t.ingressSubnetNamePrefixes != null && t.ingressSubnetNamePrefixes.isNotEmpty, "ingressSubnetNamePrefixes is required when vpcDetails is provided");
        this._config = config;
    }
    static provisionAccess(name, config) {
        var _a;
        (0, n_defensive_1.given)(name, "name").ensureHasValue().ensureIsString();
        (0, n_defensive_1.given)(config, "config").ensureHasValue().ensureHasStructure({
            lambdaDetails: "object",
            userOrRoleArn: "object"
        }).ensure(t => !(t.userOrRoleArn == null && t.awsService == null) && !(t.userOrRoleArn != null && t.awsService != null), "only one of userOrRoleArn or awsService must be provided");
        new aws.lambda.Permission(`${name}-lam-per`, {
            action: "lambda:InvokeFunction",
            function: config.lambdaDetails.functionName,
            principal: (_a = config.userOrRoleArn) !== null && _a !== void 0 ? _a : config.awsService
        });
    }
    static createAccessPolicyDocument(config) {
        (0, n_defensive_1.given)(config, "config").ensureHasValue().ensureHasStructure({
            lambdaDetails: "object"
        });
        const policy = {
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Action: ["lambda:InvokeFunction"],
                    Resource: config.lambdaDetails.lambdaArn
                }
            ]
        };
        return policy;
    }
    provision() {
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
                            .apply((subnets) => subnets.where(subnet => this._config.ingressSubnetNamePrefixes.some(prefix => subnet.subnetName.startsWith(prefix)))
                            .map(t => t.subnet.cidrBlock))
                    }
                ],
                egress: [{
                        fromPort: 0,
                        toPort: 0,
                        protocol: "-1",
                        cidrBlocks: ["0.0.0.0/0"],
                        ipv6CidrBlocks: ["::/0"]
                    }],
                tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: secGroupName })
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
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: lambdaRoleName })
        });
        const lambdaName = `${this._name}-lam`;
        const lambda = new aws.lambda.Function(lambdaName, {
            packageType: "Zip",
            // layers: ["arn:aws:lambda:us-east-2:464622532012:layer:Datadog-Extension:29"], // instrumentation
            code: new Pulumi.asset.FileArchive(this._config.codeFilePath),
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
                    .map(t => {
                    if (typeof t.value === "string")
                        return { name: t.name, value: Pulumi.output(t.value) };
                    return t;
                })
                    .reduce((acc, t) => {
                    acc[t.name] = t.value;
                    return acc;
                }, {})
            },
            vpcConfig: this._config.vpcDetails != null
                ? {
                    subnetIds: Pulumi.output(this._config.vpcDetails.vpc.getSubnets("private"))
                        .apply((subnets) => subnets.where(t => t.subnetName.startsWith(this._config.subnetNamePrefix)).map(t => t.id)),
                    securityGroupIds: [secGroup.id]
                }
                : undefined,
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: lambdaName })
        });
        if (this._config.provisionedConcurrency != null) {
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
exports.LambdaProvisioner = LambdaProvisioner;
//# sourceMappingURL=lambda-provisioner.js.map