import type { VpcSubnetConfig } from "./vpc-subnet-config.js";
export interface VpcConfig {
    cidrRange: string;
    enableVpcFlowLogs?: boolean;
    subnets: ReadonlyArray<VpcSubnetConfig>;
    numNatGateways?: 1 | 3;
}
//# sourceMappingURL=vpc-config.d.ts.map