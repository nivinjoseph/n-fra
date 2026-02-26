import { DbInstanceDetails } from "./rds-proxy-config.js";
// import * as Pulumi from "@pulumi/pulumi";

export type RdsProxyDetails = Omit<DbInstanceDetails, "instanceIdentifier">
    // & { readerHost: Pulumi.Output<string>; }
    ;