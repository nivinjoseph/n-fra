import { given } from "@nivinjoseph/n-defensive";
import { SubnetHelper } from "./subnet-helper.js";
import { VpcSubnetConfig } from "./vpc-subnet-config.js";
import { VpcSubnetType } from "./vpc-subnet-type.js";
import { ArgumentException } from "@nivinjoseph/n-exception";
import { NfraConfig } from "../common/nfra-config.js";


export class SubnetPool
{
    private readonly _cidrRange: string;
    private readonly _numSubnets: number;
    private readonly _availabilityZones = NfraConfig.awsRegionAzs;
    private readonly _allSubnets = new Array<string>();
    private readonly _availableSubnets = new Array<string>();
    private readonly _reservedSubnets = new Array<VpcSubnetConfig>();
    
    
    public constructor(vpcCidrRange: string, numSubnets: number)
    {
        given(vpcCidrRange, "vpcCidrRange").ensureHasValue().ensureIsString()
            .ensure(t => SubnetHelper.validateCidrRange(t));
        this._cidrRange = vpcCidrRange.trim();
        
        given(numSubnets, "numSubnets").ensureHasValue().ensureIsNumber()
            .ensure(t => t >= 1 && t <= 1024);
        this._numSubnets = numSubnets;
        
        this._initializePool();
    }
    
    
    public reserveSubnets(subnetPrefix: string, subnetType: VpcSubnetType, numSubnets: 1 | 2 | 3): Array<VpcSubnetConfig>
    {
        given(subnetPrefix, "subnetPrefix").ensureHasValue().ensureIsString();
        given(subnetType, "subnetType").ensureHasValue().ensureIsEnum(VpcSubnetType);
        given(numSubnets, "numSubnets").ensureHasValue().ensureIsNumber()
            .ensure(t => t > 0 && t <= 3, "must be > 0 and <= poolSubnets")
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
    
    private _initializePool(): void
    {
        this._allSubnets.push(
            ...SubnetHelper.calculateSubnets(this._cidrRange, this._numSubnets)
        );
        
        this._availableSubnets.push(...this._allSubnets);
    }
}