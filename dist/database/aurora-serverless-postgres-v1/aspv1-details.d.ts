import * as Pulumi from "@pulumi/pulumi";
export interface Aspv1Details {
    host: Pulumi.Output<string>;
    port: number;
    databaseName: Pulumi.Output<string>;
    username: Pulumi.Output<string>;
    password: Pulumi.Output<string>;
    readerHost: Pulumi.Output<string>;
}
