import * as Pulumi from "@pulumi/pulumi";
export interface Aspv2Details {
    host: Pulumi.Output<string>;
    port: Pulumi.Output<number>;
    databaseName: Pulumi.Output<string>;
    username: Pulumi.Output<string>;
    password: Pulumi.Output<string>;
    readerHost: Pulumi.Output<string>;
}