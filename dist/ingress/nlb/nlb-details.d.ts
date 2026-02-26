import * as Pulumi from "@pulumi/pulumi";
export declare class NlbDetails {
    private readonly _arn;
    private readonly _host;
    private readonly _port;
    get arn(): Pulumi.Output<string>;
    get host(): Pulumi.Output<string>;
    get port(): number;
    constructor(arn: Pulumi.Output<string>, host: Pulumi.Output<string>, port: number);
    createVpcEndpointService(name: string, allowedAwsAccounts: ReadonlyArray<string>): {
        serviceName: Pulumi.Output<string>;
    };
}
//# sourceMappingURL=nlb-details.d.ts.map