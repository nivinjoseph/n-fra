export interface DatadogIntegrationConfig
{
    ddHost: string;
    apiKey: string;
    appKey: string;
    skipCoreIntegration?: boolean;
    /**
     * @description this the Slack Account Name (string) inside datadog. Not the Slack Workspace name
     */
    slackConfig?: {
        slackAccountName: string;
        slackChannelName: string;
    };
}