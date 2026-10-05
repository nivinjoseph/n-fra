import { VpcDetails } from "../../vpc/vpc-details.js";
import type { SubnetNamePrefix } from "../../vpc/vpc-subnet-config.js";
import type { RdsInstanceSource } from "../rds-types.js";

export interface Aspv2ConfigBase
{
    /** The VPC to deploy into, as returned by `VpcProvisioner.provision()`. */
    vpcDetails: VpcDetails;
    /** Prefix of the VPC subnets the DB subnet group spans (normally isolated) (matches `VpcSubnetConfig.prefix`; see `SubnetNamePrefix`). */
    subnetNamePrefix: SubnetNamePrefix;
    /** Prefixes of the subnets whose CIDR ranges may reach port 5432; they become the security group's ingress rules. */
    ingressSubnetNamePrefixes: ReadonlyArray<SubnetNamePrefix>;
    /** Aurora Postgres major version. Default: `Aspv2DbEngineVersion.v17`. Changing it upgrades in place immediately. */
    engineVersion?: Aspv2DbEngineVersion;
    /** Master username. Default: `"appuser"`. */
    username?: string;
    /** Master password. Default: generated randomly and returned as an Output in the details. */
    password?: string;
    /** Instances in the cluster (one writer, the rest readers). Default: 3 when the stack is `prod`, otherwise 1. */
    numClusterInstances?: 1 | 2 | 3;
    /** Minimum Aurora capacity units (ACUs), e.g. 0.5. Not a task count. */
    minCapacity: number;
    /** Maximum Aurora capacity units (ACUs). */
    maxCapacity: number;
    /** Required so the choice is explicit. `true` blocks deletion of the cluster. */
    deletionProtection: boolean;
    /** Required so the choice is explicit. `true` deletes the cluster without taking a final snapshot. */
    skipFinalSnapshot: boolean;
    /**
     * @description Defaults to false. When false, an RDS Proxy is provisioned and
     * Aspv2Details host/readerHost point at the proxy's writer and read-only endpoints.
     * When true, the proxy and its supporting IAM role and security group are skipped,
     * and host/readerHost point directly at the cluster's writer and reader endpoints.
     */
    disableProxy?: boolean;
}

export type Aspv2Config = Aspv2ConfigBase & RdsInstanceSource;

export enum Aspv2DbEngineVersion
{
    v12 = 12,
    v13 = 13,
    v14 = 14,
    v15 = 15,
    v16 = 16,
    v17 = 17,
    v18 = 18
}