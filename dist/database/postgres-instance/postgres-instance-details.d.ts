import * as Pulumi from "@pulumi/pulumi";
export interface PostgresInstanceDetails {
    instanceIdentifier: Pulumi.Output<string>;
    host: Pulumi.Output<string>;
    port: number;
    databaseName: Pulumi.Output<string>;
    username: Pulumi.Output<string>;
    password: Pulumi.Output<string>;
}
//# sourceMappingURL=postgres-instance-details.d.ts.map