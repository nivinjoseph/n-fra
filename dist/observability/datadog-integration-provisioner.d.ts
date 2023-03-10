import { DatadogIntegrationConfig } from "./datadog-integration-config";
export declare class DatadogIntegrationProvisioner {
    private readonly _provider;
    private readonly _notificationSlackChannel;
    /**
     * @description Only provision this once within a given AWS account
     */
    constructor(config: DatadogIntegrationConfig);
    provision(): void;
}
