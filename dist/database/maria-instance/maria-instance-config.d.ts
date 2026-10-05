import { VpcDetails } from "../../vpc/vpc-details.js";
import type { VpcAz } from "../../vpc/vpc-az.js";
import type { SubnetNamePrefix } from "../../vpc/vpc-subnet-config.js";
import type { RdsInstanceClass, RdsInstanceSource } from "../rds-types.js";
export interface MariaInstanceConfigBase {
    /** The VPC to deploy into, as returned by `VpcProvisioner.provision()`. */
    vpcDetails: VpcDetails;
    /** Prefix of the VPC subnets the DB subnet group spans (normally isolated) (matches `VpcSubnetConfig.prefix`; see `SubnetNamePrefix`). */
    subnetNamePrefix: SubnetNamePrefix;
    /** Prefixes of the subnets whose CIDR ranges may reach port 3306; they become the security group's ingress rules. */
    ingressSubnetNamePrefixes: ReadonlyArray<SubnetNamePrefix>;
    /** Master username. Default: `"appuser"`. */
    username?: string;
    /** Master password. Default: generated randomly and returned as an Output in the details. */
    password?: string;
    /** Instance class, e.g. `"db.t4g.micro"`. */
    instanceClass: RdsInstanceClass;
    /** Allocated storage in GB; must be > 0 and <= `maxStorageGb`. */
    storageGb: number;
    /** Storage autoscaling ceiling in GB. */
    maxStorageGb: number;
    /** Encrypt storage at rest. Changing this on an existing instance forces a replacement. */
    storageEncrypted?: boolean;
    /** Provisioned IOPS (> 0) for io-class storage. Default: gp3 without provisioned IOPS. */
    provisionedIops?: number;
    /** Puts the transaction log on a dedicated volume; only with `provisionedIops`. */
    enableDedicatedLogVolumeForProvisionedIops?: boolean;
    /** Default: `false`. Note that the instance is always created with `skipFinalSnapshot`, so deleting it leaves no snapshot. */
    deletionProtection?: boolean;
    /** Default: `false`. Multi-AZ deployment with a standby; `availabilityZone` is then ignored. */
    isHA?: boolean;
    /** zone letter within the stack's region, e.g. `VpcAz.b` for `us-east-1b`; ignored when `isHA` is set */
    availabilityZone?: VpcAz;
}
export type MariaInstanceConfig = MariaInstanceConfigBase & RdsInstanceSource;
//# sourceMappingURL=maria-instance-config.d.ts.map