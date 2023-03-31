export interface DatadogIntegrationConfig {
    ddHost: string;
    apiKey: string;
    appKey: string;
    /**
     * @description this the Slack Account Name (string) inside datadog. Not the Slack Workspace name
     */
    slackAccountName: string;
    slackChannelName: string;
}
