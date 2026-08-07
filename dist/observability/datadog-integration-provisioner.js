import { given } from "@nivinjoseph/n-defensive";
// import { Policy, PolicyDocument, Role, RolePolicyAttachment } from "@pulumi/aws/iam";
import * as aws from "@pulumi/aws";
// import { MonitorJson, Provider } from "@pulumi/datadog";
import * as datadog from "@pulumi/datadog";
// import { Integration } from "@pulumi/datadog/aws/integration";
import { NfraConfig } from "../common/nfra-config.js";
import { SecretProvisioner } from "../secret/secret-provisioner.js";
export class DatadogIntegrationProvisioner {
    _provider;
    _config;
    /**
     * @description Only provision this once within a given AWS account
     */
    constructor(config) {
        given(config, "config").ensureHasValue()
            .ensureHasStructure({
            ddHost: "string",
            apiKey: "string",
            appKey: "string",
            "skipCoreIntegration?": "boolean",
            "enableFastCrashDetection?": "boolean",
            "slackConfig?": {
                slackAccountName: "string",
                slackChannelName: "string"
            }
        })
            .ensureWhen(config.enableFastCrashDetection === true, t => t.skipCoreIntegration !== true, "enableFastCrashDetection requires the core integration, which provisions the forwarder lambda");
        const dataDogProvider = new datadog.Provider("datadogProvider", {
            apiKey: config.apiKey,
            appKey: config.appKey
            // validate: true
        });
        this._provider = dataDogProvider;
        this._config = config;
    }
    async provision() {
        if (!this._config.skipCoreIntegration) {
            // We only set this up once and we do it in the stage environment
            const roleName = "DatadogIntegrationRole";
            // The external id has to exist before the role, since the role's trust policy references it,
            // and before the integration account, which is created against it at the end of this method.
            const datadogExternalId = new datadog.aws.IntegrationExternalId("datadog-external-id", {}, {
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
                tags: {
                    Name: datadogPolicyName,
                    ...NfraConfig.tags
                }
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
                        Condition: datadogExternalId.id.apply(externalId => {
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
            // Depends on the forwarder lambda above, which is why the constructor rejects this flag
            // being combined with skipCoreIntegration.
            if (this._config.enableFastCrashDetection === true)
                this._configureFastCrashDetection(forwarderLambdaArn);
        }
        this._configureSlackIntegration();
    }
    /**
     * @description Both monitors need the notification handle, and the channel resource needs the
     * account and channel names, so the "#" normalization lives here rather than being duplicated.
     */
    _resolveSlackTarget() {
        if (this._config.slackConfig == null)
            return null;
        const accountName = this._config.slackConfig.slackAccountName.trim();
        let channelName = this._config.slackConfig.slackChannelName.trim();
        if (!channelName.startsWith("#"))
            channelName = `#${channelName}`;
        return {
            accountName,
            channelName,
            handle: `@slack-${accountName}-${channelName.substring(1)}`
        };
    }
    _configureSlackIntegration() {
        const slackTarget = this._resolveSlackTarget();
        if (slackTarget == null)
            return;
        const { accountName: slackAccountName, channelName: slackChannelName } = slackTarget;
        // Registers the channel against an already connected Slack account. Connecting the Slack
        // workspace to Datadog is an OAuth flow that cannot be automated, so it has to be done by
        // hand in the Datadog UI. Without it the @ handle below resolves to nothing and Datadog
        // drops the notification silently rather than reporting an error.
        new datadog.slack.Channel("datadogAlertsChannel", {
            accountName: slackAccountName,
            channelName: slackChannelName, // Datadog expects the leading "#"
            display: {
                message: true,
                snapshot: true,
                tags: true,
                notified: true
            }
        }, {
            provider: this._provider
        });
        const notificationSlackChannel = slackTarget.handle;
        // The env tag comes from NfraConfig.tags, which uses appEnv rather than the stack name.
        const appEnv = NfraConfig.appEnv;
        // aws.ecs.service.* is tagged by servicename, not service. The service tag only exists on
        // agent emitted telemetry, so filtering on it here would silently match nothing.
        const serviceFilter = `!servicename:*tableau*, env:${appEnv}`;
        // A crash looping container gets replaced by ECS, so watching for a drop in running tasks
        // detects deployments and autoscaling rather than failures. Comparing running against
        // desired isolates the actual failure: tasks that cannot stay up. An intentional scale down
        // moves desired too, so it cancels out.
        // The -0.5 threshold tolerates brief dips; a plain < 0 would fire on a single task being
        // absent for one minute out of fifteen. It has to match options.thresholds.critical below.
        const query = `avg(last_15m):( sum:aws.ecs.service.running{${serviceFilter}} by {servicename,env}`
            + ` - sum:aws.ecs.service.desired{${serviceFilter}} by {servicename,env} ) < -0.5`;
        new datadog.MonitorJson("ecs-service-restart-monitor", {
            monitor: JSON.stringify({
                "name": `${NfraConfig.project} [${appEnv}] {{servicename.name}} has fewer running tasks than desired`,
                "type": "query alert",
                "query": query,
                "message": `Action required. Tasks are failing to stay running.\n \n ${notificationSlackChannel}`,
                "tags": [],
                "options": {
                    "notify_audit": true,
                    "renotify_statuses": [
                        "alert"
                    ],
                    "include_tags": false,
                    "thresholds": {
                        "critical": -0.5
                    },
                    "require_full_window": false,
                    // The query spans two metrics, so a gap in either one reads as no data. Alerting
                    // on that would re-notify forever for every decommissioned service; whether the
                    // AWS integration is still reporting is a separate concern from crash detection.
                    "notify_no_data": false,
                    "renotify_interval": 20,
                    // Datadog crawls the ECS API roughly every 10 minutes, so evaluating anything
                    // more recent than this reads a partial window.
                    "evaluation_delay": 1200,
                    "new_group_delay": 300,
                    "escalation_message": `{{env.name}} {{servicename.name}} still has fewer running tasks than desired. Somebody do something.\n \n ${notificationSlackChannel}`
                },
                "priority": 1,
                "restricted_roles": null
            })
        }, {
            provider: this._provider
        });
    }
    /**
     * @description The metric based monitor above cannot react faster than Datadog's ~10 minute ECS
     * crawl. ECS publishes task state changes to EventBridge within seconds, so routing those through
     * the forwarder lambda gets the detection latency down to a couple of minutes. The agent cannot be
     * used for this: on Fargate it is a sidecar that dies along with the task it would report on.
     */
    _configureFastCrashDetection(forwarderLambdaArn) {
        const appEnv = NfraConfig.appEnv;
        const ruleName = "ecs-task-crash";
        // Matching on stoppedReason rather than on a non-zero exitCode is deliberate. Apps are
        // deployed with deploymentMinimumHealthyPercent 0, so every task is stopped on every deploy,
        // and any container that does not handle SIGTERM within the stop timeout is SIGKILLed and
        // exits 137 - indistinguishable from a crash. stoppedReason carries the intent: ECS reports
        // "Essential container in task exited" when the container died on its own, versus
        // "Scaling activity initiated by (deployment ...)" for a deliberate stop.
        const crashRule = new aws.cloudwatch.EventRule(ruleName, {
            description: "Forwards crashed ECS tasks to Datadog",
            eventPattern: JSON.stringify({
                "source": ["aws.ecs"],
                "detail-type": ["ECS Task State Change"],
                "detail": {
                    "lastStatus": ["STOPPED"],
                    "stoppedReason": [
                        { "prefix": "Essential container in task exited" },
                        { "prefix": "OutOfMemoryError" }
                    ]
                }
            }),
            tags: {
                Name: ruleName,
                ...NfraConfig.tags
            }
        });
        // The forwarder honours ddsource, ddtags and service when they are present in the payload, so
        // the event is reshaped here instead of relying on how it tags a directly invoked lambda.
        // Note this is EventBridge template syntax rather than JSON: <var> substitutes the value
        // along with its quotes, so the placeholders must not be quoted here.
        const inputTemplate = `{"ddsource":"${ruleName}","service":"ecs","ddtags":"env:${appEnv}",`
            + `"group":<group>,"clusterArn":<cluster>,"stoppedReason":<reason>,"taskArn":<taskArn>}`;
        new aws.cloudwatch.EventTarget(`${ruleName}-target`, {
            rule: crashRule.name,
            arn: forwarderLambdaArn,
            inputTransformer: {
                inputPaths: {
                    cluster: "$.detail.clusterArn",
                    group: "$.detail.group",
                    reason: "$.detail.stoppedReason",
                    taskArn: "$.detail.taskArn"
                },
                inputTemplate
            }
        });
        // Without this EventBridge silently fails to invoke the forwarder.
        new aws.lambda.Permission(`${ruleName}-permission`, {
            action: "lambda:InvokeFunction",
            function: forwarderLambdaArn,
            principal: "events.amazonaws.com",
            sourceArn: crashRule.arn
        });
        const slackTarget = this._resolveSlackTarget();
        const notification = slackTarget != null ? `\n \n ${slackTarget.handle}` : "";
        // detail.group is of the form "service:<name>", so grouping by it gives per service alerting.
        // Three crashes inside 10 minutes is a crash loop rather than a one off failure.
        const query = `logs("source:${ruleName} env:${appEnv}").index("*").rollup("count").by("@group").last("10m") >= 3`;
        new datadog.MonitorJson(`${ruleName}-monitor`, {
            monitor: JSON.stringify({
                "name": `${NfraConfig.project} [${appEnv}] {{@group}} is crash looping`,
                "type": "log alert",
                "query": query,
                "message": `Action required. Containers are exiting repeatedly.${notification}`,
                "tags": [],
                "options": {
                    "notify_audit": true,
                    "renotify_statuses": [
                        "alert"
                    ],
                    "include_tags": false,
                    "thresholds": {
                        "critical": 3
                    },
                    "enable_logs_sample": true,
                    "groupby_simple_monitor": false,
                    "notify_no_data": false,
                    "renotify_interval": 20,
                    "escalation_message": `{{@group}} is still crash looping. Somebody do something.${notification}`
                },
                "priority": 1,
                "restricted_roles": null
            })
        }, {
            provider: this._provider
        });
    }
}
//# sourceMappingURL=datadog-integration-provisioner.js.map