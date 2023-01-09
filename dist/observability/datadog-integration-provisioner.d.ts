import { DatadogIntegrationConfig } from "./datadog-integration-config";
export declare class DatadogIntegrationProvisioner {
    private readonly _provider;
    private readonly _notificationSlackChannel;
    private readonly _tags;
    /**
     * @description Only provision this once within a given AWS account
     */
    constructor(config: DatadogIntegrationConfig);
    provisionResources(): void;
}
