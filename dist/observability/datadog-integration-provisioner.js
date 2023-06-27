"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatadogIntegrationProvisioner = void 0;
const tslib_1 = require("tslib");
const n_defensive_1 = require("@nivinjoseph/n-defensive");
// import { Policy, PolicyDocument, Role, RolePolicyAttachment } from "@pulumi/aws/iam";
const aws = require("@pulumi/aws");
// import { MonitorJson, Provider } from "@pulumi/datadog";
const datadog = require("@pulumi/datadog");
// import { Integration } from "@pulumi/datadog/aws/integration";
const nfra_config_1 = require("../nfra-config");
const secrets_provisioner_1 = require("../secrets/secrets-provisioner");
const datadog_api_client_1 = require("@datadog/datadog-api-client");
const Pulumi = require("@pulumi/pulumi");
class DatadogIntegrationProvisioner {
    /**
     * @description Only provision this once within a given AWS account
     */
    constructor(config) {
        (0, n_defensive_1.given)(config, "config").ensureHasValue()
            .ensureHasStructure({
            ddHost: "string",
            apiKey: "string",
            appKey: "string",
            slackAccountName: "string",
            slackChannelName: "string"
        });
        const dataDogProvider = new datadog.Provider("datadogProvider", {
            apiKey: config.apiKey,
            appKey: config.appKey
            // validate: true
        });
        this._provider = dataDogProvider;
        this._config = config;
    }
    provision() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            // We only set this up once and we do it in the stage environment
            const roleName = "DatadogIntegrationRole";
            // Create a new Datadog - Amazon Web Services integration
            const datadogIntegration = new datadog.aws.Integration("datadog-integration", {
                accountId: nfra_config_1.NfraConfig.awsAccount,
                roleName
            }, {
                provider: this._provider
            });
            const datadogAwsAccessPolicyDocument = {
                Version: "2012-10-17",
                Statement: [
                    {
                        Action: [
                            "apigateway:GET",
                            "autoscaling:Describe*",
                            "backup:List*",
                            "budgets:ViewBudget",
                            "cloudfront:GetDistributionConfig",
                            "cloudfront:ListDistributions",
                            "cloudtrail:DescribeTrails",
                            "cloudtrail:GetTrailStatus",
                            "cloudtrail:LookupEvents",
                            "cloudwatch:Describe*",
                            "cloudwatch:Get*",
                            "cloudwatch:List*",
                            "codedeploy:List*",
                            "codedeploy:BatchGet*",
                            "directconnect:Describe*",
                            "dynamodb:List*",
                            "dynamodb:Describe*",
                            "ec2:Describe*",
                            "ecs:Describe*",
                            "ecs:List*",
                            "elasticache:Describe*",
                            "elasticache:List*",
                            "elasticfilesystem:DescribeFileSystems",
                            "elasticfilesystem:DescribeTags",
                            "elasticfilesystem:DescribeAccessPoints",
                            "elasticloadbalancing:Describe*",
                            "elasticmapreduce:List*",
                            "elasticmapreduce:Describe*",
                            "es:ListTags",
                            "es:ListDomainNames",
                            "es:DescribeElasticsearchDomains",
                            "events:CreateEventBus",
                            "fsx:DescribeFileSystems",
                            "fsx:ListTagsForResource",
                            "health:DescribeEvents",
                            "health:DescribeEventDetails",
                            "health:DescribeAffectedEntities",
                            "kinesis:List*",
                            "kinesis:Describe*",
                            "lambda:GetPolicy",
                            "lambda:List*",
                            "logs:DeleteSubscriptionFilter",
                            "logs:DescribeLogGroups",
                            "logs:DescribeLogStreams",
                            "logs:DescribeSubscriptionFilters",
                            "logs:FilterLogEvents",
                            "logs:PutSubscriptionFilter",
                            "logs:TestMetricFilter",
                            "organizations:Describe*",
                            "organizations:List*",
                            "rds:Describe*",
                            "rds:List*",
                            "redshift:DescribeClusters",
                            "redshift:DescribeLoggingStatus",
                            "route53:List*",
                            "s3:GetBucketLogging",
                            "s3:GetBucketLocation",
                            "s3:GetBucketNotification",
                            "s3:GetBucketTagging",
                            "s3:ListAllMyBuckets",
                            "s3:PutBucketNotification",
                            "ses:Get*",
                            "sns:List*",
                            "sns:Publish",
                            "sqs:ListQueues",
                            "states:ListStateMachines",
                            "states:DescribeStateMachine",
                            "support:DescribeTrustedAdvisor*",
                            "support:RefreshTrustedAdvisorCheck",
                            "tag:GetResources",
                            "tag:GetTagKeys",
                            "tag:GetTagValues",
                            "xray:BatchGetTraces",
                            "xray:GetTraceSummaries"
                        ],
                        Resource: "*",
                        Effect: "Allow"
                    }
                ]
            };
            const datadogPolicyName = "datadog-policy";
            const datadogPolicy = new aws.iam.Policy(datadogPolicyName, {
                path: "/",
                description: "Datadog integration policy",
                policy: datadogAwsAccessPolicyDocument,
                tags: Object.assign({ Name: datadogPolicyName }, nfra_config_1.NfraConfig.tags)
            });
            const datadogAssumeRolePolicyDocument = {
                Version: "2012-10-17",
                Statement: [
                    {
                        Action: "sts:AssumeRole",
                        Principal: {
                            AWS: "arn:aws:iam::464622532012:root" // datadog aws account id
                        },
                        // Condition: {
                        //     "StringEquals": {
                        //         "sts:ExternalId": config.getValue("datadogExternalId")
                        //     }
                        // },
                        Condition: datadogIntegration.externalId.apply(externalId => {
                            return {
                                "StringEquals": {
                                    "sts:ExternalId": externalId
                                }
                            };
                        }),
                        Effect: "Allow"
                    }
                ]
            };
            const datadogRole = new aws.iam.Role(roleName, {
                name: roleName,
                assumeRolePolicy: datadogAssumeRolePolicyDocument,
                tags: Object.assign({ Name: roleName }, nfra_config_1.NfraConfig.tags)
            });
            new aws.iam.RolePolicyAttachment("datadogPolicyAttachment", {
                role: datadogRole,
                policyArn: datadogPolicy.arn
            });
            new aws.iam.RolePolicyAttachment("datadogCloudSecurityPolicyAttachment", {
                role: datadogRole,
                // policyArn: "arn:aws:iam::aws:policy/SecurityAudit"
                policyArn: aws.iam.ManagedPolicies.SecurityAudit
            });
            const secretsProvisioner = new secrets_provisioner_1.SecretsProvisioner();
            const apiKeySecret = secretsProvisioner.provision("datadogApiKey", this._config.apiKey);
            const datadogForwarderStack = new aws.cloudformation.Stack("datadog-forwarder", {
                parameters: {
                    DdApiKeySecretArn: apiKeySecret.arn,
                    DdSite: this._config.ddHost,
                    FunctionName: "datadog-forwarder"
                },
                capabilities: ["CAPABILITY_IAM"],
                templateUrl: "https://datadog-cloudformation-template.s3.amazonaws.com/aws/forwarder/latest.yaml"
            });
            const forwarderLambdaArn = datadogForwarderStack.outputs.apply(t => t["DatadogForwarderArn"]);
            const integrationLambdaArn = new datadog.aws.IntegrationLambdaArn("datadogLambdaCollector", {
                accountId: nfra_config_1.NfraConfig.awsAccount,
                lambdaArn: forwarderLambdaArn
            }, {
                provider: this._provider,
                dependsOn: datadogForwarderStack
            });
            try {
                // const logReadyServices = await datadog.aws.getIntegrationLogsServices({ provider: this._provider });
                // const logServices = logReadyServices.awsLogsServices;
                const logServices = yield this._fetchLogReadyService();
                new datadog.aws.IntegrationLogCollection("datadogLogCollection", {
                    accountId: nfra_config_1.NfraConfig.awsAccount,
                    services: logServices.map(t => t.id)
                }, {
                    provider: this._provider,
                    dependsOn: integrationLambdaArn
                });
                yield Pulumi.log.info("Successfully created datadog.aws.IntegrationLogCollection");
            }
            catch (e) {
                yield Pulumi.log.warn("Failed to create datadog.aws.IntegrationLogCollection");
                const error = e;
                yield Pulumi.log.error(error.message);
            }
            let slackChannelName = this._config.slackChannelName.trim();
            if (!slackChannelName.startsWith("#"))
                slackChannelName = `#${slackChannelName}`;
            new datadog.slack.Channel("datadogAlertsChannel", {
                accountName: this._config.slackAccountName.trim(),
                channelName: slackChannelName,
                display: {
                    message: true,
                    snapshot: true,
                    tags: true,
                    notified: true
                }
            }, {
                provider: this._provider
            });
            const notificationSlackChannel = `@slack-${this._config.slackAccountName.trim()}-${slackChannelName.substring(1)}`;
            new datadog.MonitorJson("ecs-service-restart-monitor", {
                monitor: JSON.stringify({
                    "name": "{{env}} {{servicename.name}} has been restarting frequently",
                    "type": "query alert",
                    "query": "change(avg(last_1h),last_15m):sum:aws.ecs.service.running{*} by {servicename,env} < 0",
                    "message": `Action required.\n \n ${notificationSlackChannel}`,
                    "tags": [],
                    "options": {
                        "notify_audit": true,
                        "renotify_statuses": [
                            "alert",
                            "no data"
                        ],
                        "silenced": {},
                        "include_tags": false,
                        "thresholds": {
                            "critical": 0
                        },
                        "require_full_window": false,
                        "notify_no_data": true,
                        "renotify_interval": 20,
                        "evaluation_delay": 1200,
                        "new_group_delay": 300,
                        "no_data_timeframe": 60,
                        "escalation_message": `{{env}} {{servicename.name}} is still restarting frequently. Somebody do something.\n \n ${notificationSlackChannel}`
                    },
                    "priority": 1,
                    "restricted_roles": null
                })
            }, {
                provider: this._provider
            });
        });
    }
    _fetchLogReadyService() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const configuration = datadog_api_client_1.client.createConfiguration({
                authMethods: {
                    apiKeyAuth: this._config.apiKey,
                    appKeyAuth: this._config.appKey
                }
            });
            const apiInstance = new datadog_api_client_1.v1.AWSLogsIntegrationApi(configuration);
            const result = yield apiInstance.listAWSLogsServices();
            return result.map(t => ({ id: t.id, label: t.label }));
        });
    }
}
exports.DatadogIntegrationProvisioner = DatadogIntegrationProvisioner;
//# sourceMappingURL=datadog-integration-provisioner.js.map