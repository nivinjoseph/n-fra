import { VpcDetails } from "../../vpc/vpc-details.js";
import * as Pulumi from "@pulumi/pulumi";
export interface PostgresInstanceConfig {
    vpcDetails: VpcDetails;
    subnetNamePrefix: string;
    ingressSubnetNamePrefixes: ReadonlyArray<string>;
    engineVersion?: 12 | 13 | 16;
    databaseName?: string;
    restoreSnapshotId?: Pulumi.Input<string>;
    username?: string;
    password?: string;
    instanceClass: string;
    storageGb: number;
    maxStorageGb: number;
    storageEncrypted?: boolean;
    provisionedIops?: number;
    enableDedicatedLogVolumeForProvisionedIops?: boolean;
    deletionProtection?: boolean;
    isHA?: boolean;
    availabilityZone?: string;
}
//# sourceMappingURL=postgres-instance-config.d.ts.map