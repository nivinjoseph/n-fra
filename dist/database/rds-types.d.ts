import type * as Pulumi from "@pulumi/pulumi";
import type { VpcAz } from "../vpc/vpc-az.js";
type RdsBurstableFamily = "t3" | "t4g";
type RdsGeneralPurposeFamily = "m5" | "m6g" | "m6i" | "m7g" | "m7i";
type RdsMemoryOptimizedFamily = "r5" | "r6g" | "r6i" | "r7g" | "r7i";
type RdsBurstableSize = "micro" | "small" | "medium" | "large" | "xlarge" | "2xlarge";
type RdsStandardSize = "large" | "xlarge" | "2xlarge" | "4xlarge" | "8xlarge" | "12xlarge" | "16xlarge" | "24xlarge";
/**
 * RDS instance class for Postgres and MariaDB instances, e.g. `"db.t4g.micro"` or `"db.r6g.large"`.
 * The burstable (t3, t4g), general purpose (m5 to m7) and memory optimized (r5 to r7) families autocomplete; any other
 * `db.<family>.<size>` literal is accepted too, and the provisioner checks the format at runtime. A plain `string`
 * variable (e.g. from Pulumi config) needs `as RdsInstanceClass`.
 * @see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.DBInstanceClass.html
 */
export type RdsInstanceClass = `db.${RdsBurstableFamily}.${RdsBurstableSize}` | `db.${RdsGeneralPurposeFamily | RdsMemoryOptimizedFamily}.${RdsStandardSize}` | (`db.${string}.${string}` & Record<never, never>);
/**
 * Where the database comes from: a new empty database called `databaseName`, or a restore of the RDS snapshot
 * `restoreSnapshotId` (a plain id or a Pulumi Output, e.g. from another stack). Exactly one must be given.
 */
export type RdsInstanceSource = {
    databaseName: string;
    restoreSnapshotId?: never;
} | {
    restoreSnapshotId: Pulumi.Input<string>;
    databaseName?: never;
};
/** Non-union view of `RdsInstanceSource` for runtime validation with `given()`; the exactly-one rule is re-checked at runtime. */
export interface RdsInstanceSourceShape {
    databaseName?: string;
    restoreSnapshotId?: Pulumi.Input<string>;
}
/** Format every `RdsInstanceClass` must have: `db.<family>.<size>` in lowercase letters and digits. */
export declare const rdsInstanceClassPattern: RegExp;
/**
 * Validation shared by the Postgres and MariaDB instance provisioners: the instance class format, and that any
 * `availabilityZone` letter exists in the stack's region. Reads `aws:region` only when a zone is given.
 */
export declare function ensureRdsInstancePlacement(config: {
    instanceClass: string;
    availabilityZone?: VpcAz;
}): void;
export {};
//# sourceMappingURL=rds-types.d.ts.map