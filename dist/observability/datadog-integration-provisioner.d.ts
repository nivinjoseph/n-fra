import { DatadogIntegrationConfig } from "./datadog-integration-config.js";
export declare class DatadogIntegrationProvisioner {
    private readonly _provider;
    private readonly _config;
    /**
     * @description Only provision this once within a given AWS account
     */
    constructor(config: DatadogIntegrationConfig);
    provision(): Promise<void>;
    private _fetchLogReadyService;
    private _configureSlackIntegration;
}
//# sourceMappingURL=datadog-integration-provisioner.d.ts.map