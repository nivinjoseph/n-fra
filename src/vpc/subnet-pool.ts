import { given } from "@nivinjoseph/n-defensive";
import { SubnetHelper } from "./subnet-helper.js";
import { VpcSubnetConfig } from "./vpc-subnet-config.js";
import { VpcSubnetType } from "./vpc-subnet-type.js";
import { ArgumentException } from "@nivinjoseph/n-exception";
import { NfraConfig } from "../common/nfra-config.js";


export class SubnetPool
{
    private readonly _cidrRange: string;
    private readonly _availabilityZones = NfraConfig.awsRegionAzs;
    private readonly _allSubnets = new Array<string>();
    private readonly _availableSubnets = new Array<string>();
    private readonly _reservedSubnets = new Array<VpcSubnetConfig>();
    
    
    /**
     * Splits `vpcCidrRange` into equal subnets (the smallest power of two that is at least `numSubnets`)
     * that `reserveSubnets` hands out in order. The count is limited only by the host bits of the range.
     * For a VPC built with n-fra 5.0.9 or earlier and a `numSubnets` above 256, use `SubnetPool.legacy` instead:
     * the constructor now produces a correct split for those counts, which is a different layout.
     */
    public constructor(vpcCidrRange: string, numSubnets: number)
    {
        given(vpcCidrRange, "vpcCidrRange").ensureHasValue().ensureIsString()
            .ensure(t => SubnetHelper.validateCidrRange(t));
        this._cidrRange = vpcCidrRange.trim();
        
        given(numSubnets, "numSubnets").ensureHasValue().ensureIsNumber()
            .ensure(t => Number.isInteger(t) && t >= 1, "must be a positive integer");
        
        this._initializePool(SubnetHelper.calculateSubnets(this._cidrRange, numSubnets));
    }
    
    
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
    public static legacy(vpcCidrRange: string): SubnetPool
    {
        given(vpcCidrRange, "vpcCidrRange").ensureHasValue().ensureIsString()
            .ensure(t => SubnetHelper.validateCidrRange(t));
        
        // Computed before the pool exists so a narrow range fails with the legacy requirement, not the 256-subnet one.
        const legacySubnets = SubnetHelper.calculateLegacySubnets(vpcCidrRange);
        
        // The legacy layout is the 256-subnet layout with every block narrowed by one bit; nothing has been reserved yet.
        const pool = new SubnetPool(vpcCidrRange, 256);
        pool._initializePool(legacySubnets);
        return pool;
    }
    
    
    public reserveSubnets(subnetPrefix: string, subnetType: VpcSubnetType, numSubnets: 1 | 2 | 3): Array<VpcSubnetConfig>
    {
        given(subnetPrefix, "subnetPrefix").ensureHasValue().ensureIsString();
        given(subnetType, "subnetType").ensureHasValue().ensureIsEnum(VpcSubnetType);
        given(numSubnets, "numSubnets").ensureHasValue().ensureIsNumber()
            .ensure(t => t > 0 && t <= 3, "must be between 1 and 3")
            .ensure(t => t <= this._availableSubnets.length, "not enough subnets left in the pool");
        
        const reservations = new Array<VpcSubnetConfig>();
        
        for (let i = 0; i < numSubnets; i++)
        {
            const cidr = this._availableSubnets[i];
            const reservation: VpcSubnetConfig = {
                name: `${subnetPrefix}-${i + 1}`,
                type: subnetType,
                az: this._availabilityZones[i],
                cidrRange: cidr,
                prefix: subnetPrefix
            };
            if (this._reservedSubnets.some(t => t.name === reservation.name))
                throw new ArgumentException("subnetPrefix", "naming conflict detected");
            
            // This is an extra layer of defensiveness to be sure
            given(reservation, "reservation")
                .ensure(t =>
                    this._reservedSubnets.every(u => u.cidrRange !== t.cidrRange),
                    "cidr conflict detected");
            
            reservations.push(reservation);
        }
        
        reservations
            .forEach(reservation => this._availableSubnets.remove(reservation.cidrRange));
        
        this._reservedSubnets.push(...reservations);
        
        return reservations;
    }
    
    private _initializePool(subnets: ReadonlyArray<string>): void
    {
        this._allSubnets.length = 0;
        this._allSubnets.push(...subnets);
        
        this._availableSubnets.length = 0;
        this._availableSubnets.push(...subnets);
    }
}
