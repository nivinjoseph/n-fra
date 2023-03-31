import { given } from "@nivinjoseph/n-defensive";
// import { Policy, PolicyDocument, Role, RolePolicyAttachment } from "@pulumi/aws/iam";
import * as aws from "@pulumi/aws";
// import { MonitorJson, Provider } from "@pulumi/datadog";
import * as datadog from "@pulumi/datadog";
// import { Integration } from "@pulumi/datadog/aws/integration";
import { NfraConfig } from "../nfra-config";
import { SecretsProvisioner } from "../secrets/secrets-provisioner";
import { DatadogIntegrationConfig } from "./datadog-integration-config";


export class DatadogIntegrationProvisioner
{
    private readonly _provider: datadog.Provider;
    private readonly _config: DatadogIntegrationConfig;

    /**
     * @description Only provision this once within a given AWS account 
     */
    public constructor(config: DatadogIntegrationConfig)
    {
        given(config, "config").ensureHasValue()
            .ensureHasStructure({
                ddHost: "string",
                apiKey: "string",
                appKey: "string",
                slackAccountName: "string",
                slackChannelName: "string"
            });
        
        const dataDogProvider = new datadog.Provider("datadogProvider", {
            apiKey: config.apiKey,
            appKey: config.appKey,
            validate: true
        });

        this._provider = dataDogProvider;
        
        this._config = config;
    }


    public async provision(): Promise<void>
    {
        // We only set this up once and we do it in the stage environment

        const roleName = "DatadogIntegrationRole";

        // Create a new Datadog - Amazon Web Services integration
        const datadogIntegration = new datadog.aws.Integration("datadog-integration", {
            accountId: NfraConfig.awsAccount,
            roleName
        }, {
            provider: this._provider
        });

        const datadogAwsAccessPolicyDocument: aws.iam.PolicyDocument = {
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
            tags: {
                Name: datadogPolicyName,
                ...NfraConfig.tags
            }
        });

        const datadogAssumeRolePolicyDocument: aws.iam.PolicyDocument = {
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
                    Condition: datadogIntegration.externalId.apply(externalId =>
                    {
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
            tags: {
                Name: roleName,
                ...NfraConfig.tags
            }
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
        
        const secretsProvisioner = new SecretsProvisioner();
        const apiKeySecret = secretsProvisioner.provision("datadogApiKey", this._config.apiKey);
        
        const datadogForwarderStack = new aws.cloudformation.Stack("datadog-forwarder", {
            parameters: {
                DdApiKeySecretArn: apiKeySecret.arn,
                DdSite: this._config.ddHost,
                FunctionName: "datadog-forwarder"
            },
            templateUrl: "https://datadog-cloudformation-template.s3.amazonaws.com/aws/forwarder/latest.yaml"
        });
        
        const forwarderLambdaArn = datadogForwarderStack.outputs.apply(t => t["DatadogForwarderArn"]);
        
        new datadog.aws.IntegrationLambdaArn("datadogLambdaCollector", {
            accountId: NfraConfig.awsAccount,
            lambdaArn: forwarderLambdaArn
        }, {
            provider: this._provider
        });
        
        const logReadyServices = await datadog.aws.getIntegrationLogsServices({provider: this._provider});
        
        new datadog.aws.IntegrationLogCollection("datadogLogCollection", {
            accountId: NfraConfig.awsAccount,
            services: logReadyServices.awsLogsServices.map(t => t.id)
        }, {
            provider: this._provider
        });
        
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
        
        new datadog.MonitorJson("ecs-service-restart-monitor", {
            monitor: JSON.stringify({
                "name": "{{env}} {{servicename.name}} has been restarting frequently",
                "type": "query alert",
                "query": "change(avg(last_1h),last_15m):sum:aws.ecs.service.running{*} by {servicename,env} < 0",
                "message": `Action required.\n \n @slack-${this._config.slackAccountName.trim()}-${slackChannelName.substring(1)}`,
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
        }, {
            provider: this._provider
        });
    }
}