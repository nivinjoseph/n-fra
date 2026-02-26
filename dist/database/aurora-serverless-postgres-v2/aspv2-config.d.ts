import { VpcDetails } from "../../vpc/vpc-details.js";
import * as Pulumi from "@pulumi/pulumi";
export interface Aspv2Config {
    vpcDetails: VpcDetails;
    subnetNamePrefix: string;
    ingressSubnetNamePrefixes: ReadonlyArray<string>;
    engineVersion?: Aspv2DbEngineVersion;
    databaseName?: string;
    restoreSnapshotId?: Pulumi.Input<string>;
    username?: string;
    password?: string;
    numClusterInstances?: 1 | 2 | 3;
    minCapacity: number;
    maxCapacity: number;
    deletionProtection: boolean;
    skipFinalSnapshot: boolean;
}
export declare enum Aspv2DbEngineVersion {
    v12 = 12,
    v13 = 13,
    v14 = 14,
    v15 = 15,
    v16 = 16,
    v17 = 17
}
//# sourceMappingURL=aspv2-config.d.ts.map