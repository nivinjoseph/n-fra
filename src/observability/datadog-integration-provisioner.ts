import { given } from "@nivinjoseph/n-defensive";
// import { Policy, PolicyDocument, Role, RolePolicyAttachment } from "@pulumi/aws/iam";
import * as aws from "@pulumi/aws";
// import { MonitorJson, Provider } from "@pulumi/datadog";
import * as datadog from "@pulumi/datadog";
// import { Integration } from "@pulumi/datadog/aws/integration";
import { NfraConfig } from "../common/nfra-config.js";
import { SecretProvisioner } from "../secret/secret-provisioner.js";
import { DatadogIntegrationConfig } from "./datadog-integration-config.js";


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
                "skipCoreIntegration?": "boolean",
                "slackConfig?": {
                    slackAccountName: "string",
                    slackChannelName: "string"
                }
            });

        const dataDogProvider = new datadog.Provider("datadogProvider", {
            apiKey: config.apiKey,
            appKey: config.appKey
            // validate: true
        });

        this._provider = dataDogProvider;

        this._config = config;
    }


    public async provision(): Promise<void>
    {
        if (!this._config.skipCoreIntegration)
        {
            // We only set this up once and we do it in the stage environment

            const roleName = "DatadogIntegrationRole";

            // The external id has to exist before the role, since the role's trust policy references it,
            // and before the integration account, which is created against it at the end of this method.
            const datadogExternalId = new datadog.aws.IntegrationExternalId("datadog-external-id", {}, {
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
                        Condition: datadogExternalId.id.apply(externalId =>
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

            const datadogPolicyAttachment = new aws.iam.RolePolicyAttachment("datadogPolicyAttachment", {
                role: datadogRole,
                policyArn: datadogPolicy.arn
            });

            const datadogCloudSecurityPolicyAttachment = new aws.iam.RolePolicyAttachment("datadogCloudSecurityPolicyAttachment", {
                role: datadogRole,
                // policyArn: "arn:aws:iam::aws:policy/SecurityAudit"
                policyArn: aws.iam.ManagedPolicy.SecurityAudit
            });

            const secretsProvisioner = new SecretProvisioner();
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

            // Deliberately not guarded. If this fails we cannot know the correct set of sources, and
            // letting it throw aborts the program before any resource below is registered, leaving an
            // existing integration untouched. Catching it here would write sources: [] to the live
            // integration, disabling log collection.
            const logReadyServices = await datadog.aws.getIntegrationAvailableLogsServices({
                provider: this._provider
            });

            // Metrics, log collection and the lambda forwarder are all configured on this single resource.
            // It is created last because Datadog validates that it can assume the role at creation time;
            // because IAM propagation is eventually consistent, a first-time provision can fail transiently
            // here even though the ordering below is correct. Re-running the deployment resolves it.
            new datadog.aws.IntegrationAccount("datadog-integration", {
                awsAccountId: NfraConfig.awsAccount,
                awsPartition: "aws", // FIXME: The aws_partition property in the Datadog AWS integration (datadog_integration_aws_account or datadog.aws.IntegrationAccount) defines the specific AWS partition your account resides in. Acceptable values are aws for commercial regions, aws-cn for China, and aws-us-gov for GovCloud
                authConfig: {
                    awsAuthConfigRole: {
                        roleName,
                        externalId: datadogExternalId.id
                    }
                },
                awsRegions: { includeAll: true },
                logsConfig: {
                    lambdaForwarder: {
                        lambdas: [forwarderLambdaArn],
                        sources: logReadyServices.awsLogsServices
                    }
                },
                // An empty namespaceFilters block applies Datadog's default exclusions of AWS/SQS,
                // AWS/ElasticMapReduce and AWS/Usage, which keeps CloudWatch GetMetricData costs down.
                // These namespaces were collected under @pulumi/datadog v4. Set excludeOnlies: [] to go
                // back to collecting everything.
                metricsConfig: { namespaceFilters: {} },
                resourcesConfig: {
                    extendedCollection: true,
                    cloudSecurityPostureManagementCollection: true
                },
                tracesConfig: { xrayServices: {} }
            }, {
                provider: this._provider,
                dependsOn: [
                    datadogRole,
                    datadogPolicyAttachment,
                    datadogCloudSecurityPolicyAttachment,
                    datadogForwarderStack
                ]
            });
        }

        this._configureSlackIntegration();
    }

    private _configureSlackIntegration(): void
    {
        if (this._config.slackConfig == null)
            return;

        let slackChannelName = this._config.slackConfig.slackChannelName.trim();
        if (!slackChannelName.startsWith("#"))
            slackChannelName = `#${slackChannelName}`;

        // new datadog.slack.Channel("datadogAlertsChannel", {
        //     accountName: slackChannelName,
        //     display: {
        //         message: true,
        //         snapshot: true,
        //         tags: true,
        //         notified: true
        //     }
        // }, {
        //     provider: this._provider
        // }); this._config.slackConfig.slackAccountName.trim(),
        //     channelName:

        const notificationSlackChannel = `@slack-${this._config.slackConfig.slackAccountName.trim()}-${slackChannelName.substring(1)}`;

        new datadog.MonitorJson("ecs-service-restart-monitor", {
            monitor: JSON.stringify({
                "name": `${NfraConfig.project} [${NfraConfig.env}] {{servicename.name}} has been restarting frequently`,
                "type": "query alert",
                "query": `change(avg(last_1h),last_15m):sum:aws.ecs.service.running{!service:*tableau* , env:${NfraConfig.env}} by {servicename,env} < 0`,
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
    }
}