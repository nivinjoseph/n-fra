import { DatadogIntegrationConfig } from "./datadog-integration-config.js";
export declare class DatadogIntegrationProvisioner {
    private readonly _provider;
    private readonly _config;
    /**
     * @description Only provision this once within a given AWS account
     */
    constructor(config: DatadogIntegrationConfig);
    provision(): Promise<void>;
    /**
     * @description Both monitors need the notification handle, and the channel resource needs the
     * account and channel names, so the "#" normalization lives here rather than being duplicated.
     */
    private _resolveSlackTarget;
    private _configureSlackIntegration;
    /**
     * @description The metric based monitor above cannot react faster than Datadog's ~10 minute ECS
     * crawl. ECS publishes task state changes to EventBridge within seconds, so routing those through
     * the forwarder lambda gets the detection latency down to a couple of minutes. The agent cannot be
     * used for this: on Fargate it is a sidecar that dies along with the task it would report on.
     */
    private _configureFastCrashDetection;
}
//# sourceMappingURL=datadog-integration-provisioner.d.ts.map