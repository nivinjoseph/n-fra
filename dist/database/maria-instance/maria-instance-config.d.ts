import { VpcDetails } from "../../vpc/vpc-details.js";
import * as Pulumi from "@pulumi/pulumi";
export interface MariaInstanceConfig {
    vpcDetails: VpcDetails;
    subnetNamePrefix: string;
    ingressSubnetNamePrefixes: ReadonlyArray<string>;
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
//# sourceMappingURL=maria-instance-config.d.ts.map