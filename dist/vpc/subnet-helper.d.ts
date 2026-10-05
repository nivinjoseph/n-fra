export declare class SubnetHelper {
    static convertBinaryToDecimal(input: string): number;
    static convertDecimalToBinary(input: number | string): string;
    /**
     * Splits `cidrRange` into equal subnets: the smallest power of two that is at least `numSubnets`, in address order.
     * The only limit is the host bits of the range (a `/16` holds up to 65536 `/32` entries); host bits set in
     * `cidrRange` itself are ignored.
     *
     * @throws ArgumentException when `cidrRange` has fewer host bits than the count needs.
     */
    static calculateSubnets(cidrRange: string, numSubnets: number): Array<string>;
    /**
     * Reproduces the subnet layout that n-fra 5.0.9 and earlier produced for `calculateSubnets(cidrRange, numSubnets)`
     * with `numSubnets` between 257 and 1024: the 256-subnet layout of `cidrRange` with every prefix length one bit
     * longer, so each subnet is the lower half of its block and the upper half was never allocatable
     * (for `10.11.0.0/16` that is `10.11.0.0/25`, `10.11.1.0/25`, ... `10.11.255.0/25`). The old code also padded
     * the list with copies of the last entry up to 512 or 1024 entries; those are omitted because a duplicate CIDR
     * could never be reserved.
     *
     * Subnet CIDRs cannot be changed in place, so this exists only to keep the subnets of VPCs that were built that way.
     * New VPCs should use `calculateSubnets` or `new SubnetPool(cidrRange, numSubnets)`, which now produce a correct split
     * for any count the range can hold; above 256 that split is a different layout from this one.
     *
     * @throws ArgumentException when `cidrRange` is /24 or narrower (the layout needs 9 subnet bits).
     */
    static calculateLegacySubnets(cidrRange: string): Array<string>;
    /**
     * True when every address of `cidrRange` lies inside `parentCidrRange`; a range is inside itself.
     * Both arguments must be valid CIDR ranges.
     */
    static isCidrWithin(cidrRange: string, parentCidrRange: string): boolean;
    static validateCidrRange(cidrRange: string): boolean;
    private static _parseCidr;
}
//# sourceMappingURL=subnet-helper.d.ts.map