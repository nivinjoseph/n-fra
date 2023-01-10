"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatadogIntegrationProvisioner = void 0;
const n_defensive_1 = require("@nivinjoseph/n-defensive");
// import { Policy, PolicyDocument, Role, RolePolicyAttachment } from "@pulumi/aws/iam";
const aws = require("@pulumi/aws");
// import { MonitorJson, Provider } from "@pulumi/datadog";
const datadog = require("@pulumi/datadog");
// import { Integration } from "@pulumi/datadog/aws/integration";
const infra_config_1 = require("../infra-config");
class DatadogIntegrationProvisioner {
    /**
     * @description Only provision this once within a given AWS account
     */
    constructor(config) {
        (0, n_defensive_1.given)(config, "config").ensureHasValue()
            .ensureHasStructure({
            apiKey: "string",
            appKey: "string",
            notificationsSlackChannel: "string"
        });
        const dataDogProvider = new datadog.Provider("datadogProvider", {
            apiKey: config.apiKey,
            appKey: config.appKey,
            validate: true
        });
        this._provider = dataDogProvider;
        const { notificationsSlackChannel } = config;
        (0, n_defensive_1.given)(notificationsSlackChannel, "notificationsSlackChannel").ensure(t => t.startsWith("@slack"));
        this._notificationSlackChannel = notificationsSlackChannel;
    }
    provisionResources() {
        // We only set this up once and we do it in the stage environment
        const roleName = "DatadogIntegrationRole";
        // Create a new Datadog - Amazon Web Services integration
        const datadogIntegration = new datadog.aws.Integration("datadog-integration", {
            accountId: infra_config_1.InfraConfig.awsAccount,
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
                        "organizations:DescribeOrganization",
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
                        "support:*",
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
            tags: Object.assign({ Name: datadogPolicyName }, infra_config_1.InfraConfig.tags)
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
            tags: Object.assign({ Name: roleName }, infra_config_1.InfraConfig.tags)
        });
        new aws.iam.RolePolicyAttachment("datadogPolicyAttachment", {
            role: datadogRole,
            policyArn: datadogPolicy.arn
        });
        new aws.iam.RolePolicyAttachment("datadogCloudSecurityPolicyAttachment", {
            role: datadogRole,
            policyArn: "arn:aws:iam::aws:policy/SecurityAudit"
        });
        new datadog.MonitorJson("ecs-service-restart-monitor", {
            monitor: JSON.stringify({
                "name": "{{env}} {{servicename.name}} has been restarting frequently",
                "type": "query alert",
                "query": "change(avg(last_1h),last_15m):sum:aws.ecs.service.running{*} by {servicename,env} < 0",
                "message": `Action required.\n \n ${this._notificationSlackChannel}`,
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
                    "escalation_message": `{{env}} {{servicename.name}} is still restarting frequently. Somebody do something.\n \n ${this._notificationSlackChannel}`
                },
                "priority": 1,
                "restricted_roles": null
            })
        }, { provider: this._provider });
    }
}
exports.DatadogIntegrationProvisioner = DatadogIntegrationProvisioner;
//# sourceMappingURL=datadog-integration-provisioner.js.map