import { VpcSubnetConfig } from "./vpc-subnet-config.js";
import { VpcSubnetType } from "./vpc-subnet-type.js";
export declare class SubnetPool {
    private readonly _cidrRange;
    private readonly _availabilityZones;
    private readonly _allSubnets;
    private readonly _availableSubnets;
    private readonly _reservedSubnets;
    /**
     * Splits `vpcCidrRange` into equal subnets (the smallest power of two that is at least `numSubnets`)
     * that `reserveSubnets` hands out in order. The count is limited only by the host bits of the range.
     * For a VPC built with n-fra 5.0.9 or earlier and a `numSubnets` above 256, use `SubnetPool.legacy` instead:
     * the constructor now produces a correct split for those counts, which is a different layout.
     */
    constructor(vpcCidrRange: string, numSubnets: number);
    /**
     * Builds a pool with the subnet layout that n-fra 5.0.9 and earlier produced for
     * `new SubnetPool(vpcCidrRange, numSubnets)` with `numSubnets` between 257 and 1024
     * (see `SubnetHelper.calculateLegacySubnets`): 256 subnets, each the lower half of its block,
     * handed out in the same order as before.
     *
     * Use it only for VPCs that were provisioned that way, so their subnet CIDRs (which cannot be changed in place)
     * stay the same; `pulumi preview` must then show no create or replace on `aws:ec2/subnet:Subnet`.
     * New VPCs should use the constructor; above 256 it now produces a correct split, which is a different layout from this one.
     *
     * @throws ArgumentException when `vpcCidrRange` is /24 or narrower (the legacy layout needs 9 subnet bits).
     */
    static legacy(vpcCidrRange: string): SubnetPool;
    reserveSubnets(subnetPrefix: string, subnetType: VpcSubnetType, numSubnets: 1 | 2 | 3): Array<VpcSubnetConfig>;
    private _initializePool;
}
//# sourceMappingURL=subnet-pool.d.ts.map