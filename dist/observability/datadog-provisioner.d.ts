export declare class DatadogProvisioner {
    private readonly _provider;
    private readonly _notificationSlackChannel;
    private readonly _tags;
    constructor(config: {
        apiKey: string;
        appKey: string;
        notificationsSlackChannel: string;
    });
    provisionResources(): void;
}
