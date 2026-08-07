export interface DatadogIntegrationConfig
{
    ddHost: string;
    apiKey: string;
    appKey: string;
    skipCoreIntegration?: boolean;
    /**
     * @description Adds an EventBridge rule and a Datadog log monitor that alert on ECS task crashes
     * within a couple of minutes, rather than the ~35 minutes the metric based monitor needs (Datadog
     * crawls the ECS API roughly every 10 minutes). Requires skipCoreIntegration to be false, since it
     * routes events through the Datadog forwarder lambda that the core integration provisions.
     */
    enableFastCrashDetection?: boolean;
    /**
     * @description this the Slack Account Name (string) inside datadog. Not the Slack Workspace name
     */
    slackConfig?: {
        slackAccountName: string;
        slackChannelName: string;
    };
}