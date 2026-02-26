import * as Pulumi from "@pulumi/pulumi";
export interface MariaInstanceDetails {
    instanceIdentifier: Pulumi.Output<string>;
    host: Pulumi.Output<string>;
    port: number;
    databaseName: Pulumi.Output<string>;
    username: Pulumi.Output<string>;
    password: Pulumi.Output<string>;
}
//# sourceMappingURL=maria-instance-details.d.ts.map