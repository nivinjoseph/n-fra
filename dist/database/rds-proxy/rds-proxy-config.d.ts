import { VpcDetails } from "../../vpc/vpc-details.js";
import { MariaInstanceDetails } from "../maria-instance/maria-instance-details.js";
import { PostgresInstanceDetails } from "../postgres-instance/postgres-instance-details.js";
export interface RdsProxyConfig {
    dbDetails: DbInstanceDetails;
    engineFamily: RdsProxyEngineFamily;
    vpcDetails: VpcDetails;
    dbSubnetNamePrefix: string;
    ingressSubnetNamePrefixes: ReadonlyArray<string>;
}
export declare enum RdsProxyEngineFamily {
    maria = "MYSQL",// its MYSQL for maria and mySql
    postgres = "POSTGRESQL"
}
export type DbInstanceDetails = PostgresInstanceDetails | MariaInstanceDetails;
//# sourceMappingURL=rds-proxy-config.d.ts.map