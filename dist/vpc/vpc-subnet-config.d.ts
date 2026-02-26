import { VpcAz } from "./vpc-az.js";
import { VpcSubnetType } from "./vpc-subnet-type.js";
export interface VpcSubnetConfig {
    name: string;
    type: VpcSubnetType;
    cidrRange: string;
    az: VpcAz;
    prefix: string;
}
//# sourceMappingURL=vpc-subnet-config.d.ts.map