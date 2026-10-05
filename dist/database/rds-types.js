import { given } from "@nivinjoseph/n-defensive";
import { NfraConfig } from "../common/nfra-config.js";
/** Format every `RdsInstanceClass` must have: `db.<family>.<size>` in lowercase letters and digits. */
export const rdsInstanceClassPattern = /^db\.[a-z0-9]+\.[a-z0-9]+$/;
/**
 * Validation shared by the Postgres and MariaDB instance provisioners: the instance class format, and that any
 * `availabilityZone` letter exists in the stack's region. Reads `aws:region` only when a zone is given.
 */
export function ensureRdsInstancePlacement(config) {
    given(config, "config")
        .ensure(t => rdsInstanceClassPattern.test(t.instanceClass), "instanceClass must be an RDS instance class such as db.t4g.micro");
    if (config.availabilityZone != null)
        given(config, "config").ensure(t => NfraConfig.awsRegionAzs.contains(t.availabilityZone), `availabilityZone must be one of ${NfraConfig.awsRegionAzs.join(", ")} (a zone letter within region ${NfraConfig.awsRegion})`);
}
//# sourceMappingURL=rds-types.js.map