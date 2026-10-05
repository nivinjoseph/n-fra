import type { SubnetNamePrefix } from "../../vpc/vpc-subnet-config.js";
import { VpcDetails } from "../../vpc/vpc-details.js";
import { MariaInstanceDetails } from "../maria-instance/maria-instance-details.js";
import { PostgresInstanceDetails } from "../postgres-instance/postgres-instance-details.js";
export interface RdsProxyConfig {
    /** The Postgres or MariaDB instance to front, from its provisioner's `provision()`. */
    dbDetails: DbInstanceDetails;
    /** `postgres` for Postgres, `maria` for MariaDB (RDS calls that family `MYSQL`). */
    engineFamily: RdsProxyEngineFamily;
    /** The VPC to deploy into, as returned by `VpcProvisioner.provision()`. */
    vpcDetails: VpcDetails;
    /** Prefix of the VPC subnets the proxy endpoints are placed in, normally the database's `subnetNamePrefix` (matches `VpcSubnetConfig.prefix`; see `SubnetNamePrefix`). */
    dbSubnetNamePrefix: SubnetNamePrefix;
    /** Prefixes of the subnets whose CIDR ranges may reach the proxy; they become the security group's ingress rules. */
    ingressSubnetNamePrefixes: ReadonlyArray<SubnetNamePrefix>;
}
export declare enum RdsProxyEngineFamily {
    maria = "MYSQL",// its MYSQL for maria and mySql
    postgres = "POSTGRESQL"
}
export type DbInstanceDetails = PostgresInstanceDetails | MariaInstanceDetails;
//# sourceMappingURL=rds-proxy-config.d.ts.map