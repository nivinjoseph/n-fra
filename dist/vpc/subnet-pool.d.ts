import { VpcSubnetConfig } from "./vpc-subnet-config.js";
import { VpcSubnetType } from "./vpc-subnet-type.js";
export declare class SubnetPool {
    private readonly _cidrRange;
    private readonly _numSubnets;
    private readonly _availabilityZones;
    private readonly _allSubnets;
    private readonly _availableSubnets;
    private readonly _reservedSubnets;
    constructor(vpcCidrRange: string, numSubnets: number);
    reserveSubnets(subnetPrefix: string, subnetType: VpcSubnetType, numSubnets: 1 | 2 | 3): Array<VpcSubnetConfig>;
    private _initializePool;
}
//# sourceMappingURL=subnet-pool.d.ts.map