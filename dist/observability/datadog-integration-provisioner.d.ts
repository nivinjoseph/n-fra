import { DatadogIntegrationConfig } from "./datadog-integration-config";
export declare class DatadogIntegrationProvisioner {
    private readonly _provider;
    private readonly _config;
    /**
     * @description Only provision this once within a given AWS account
     */
    constructor(config: DatadogIntegrationConfig);
    provision(): Promise<void>;
    private _fetchLogReadyService;
}
