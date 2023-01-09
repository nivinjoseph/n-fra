import { VpcSubnetConfig } from "./vpc-subnet-config";
export interface VpcConfig {
    cidr16Bits: string;
    enableVpcFlowLogs?: boolean;
    subnets: ReadonlyArray<VpcSubnetConfig>;
}
