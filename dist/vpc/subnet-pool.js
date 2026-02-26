import { given } from "@nivinjoseph/n-defensive";
import { SubnetHelper } from "./subnet-helper.js";
import { VpcSubnetType } from "./vpc-subnet-type.js";
import { ArgumentException } from "@nivinjoseph/n-exception";
import { NfraConfig } from "../common/nfra-config.js";
export class SubnetPool {
    constructor(vpcCidrRange, numSubnets) {
        this._availabilityZones = NfraConfig.awsRegionAzs;
        this._allSubnets = new Array();
        this._availableSubnets = new Array();
        this._reservedSubnets = new Array();
        given(vpcCidrRange, "vpcCidrRange").ensureHasValue().ensureIsString()
            .ensure(t => SubnetHelper.validateCidrRange(t));
        this._cidrRange = vpcCidrRange.trim();
        given(numSubnets, "numSubnets").ensureHasValue().ensureIsNumber()
            .ensure(t => t >= 1 && t <= 1024);
        this._numSubnets = numSubnets;
        this._initializePool();
    }
    reserveSubnets(subnetPrefix, subnetType, numSubnets) {
        given(subnetPrefix, "subnetPrefix").ensureHasValue().ensureIsString();
        given(subnetType, "subnetType").ensureHasValue().ensureIsEnum(VpcSubnetType);
        given(numSubnets, "numSubnets").ensureHasValue().ensureIsNumber()
            .ensure(t => t > 0 && t <= 3, "must be > 0 and <= poolSubnets")
            .ensure(t => t <= this._availableSubnets.length, "not enough subnets left in the pool");
        const reservations = new Array();
        for (let i = 0; i < numSubnets; i++) {
            const cidr = this._availableSubnets[i];
            const reservation = {
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
                .ensure(t => this._reservedSubnets.every(u => u.cidrRange !== t.cidrRange), "cidr conflict detected");
            reservations.push(reservation);
        }
        reservations
            .forEach(reservation => this._availableSubnets.remove(reservation.cidrRange));
        this._reservedSubnets.push(...reservations);
        return reservations;
    }
    _initializePool() {
        this._allSubnets.push(...SubnetHelper.calculateSubnets(this._cidrRange, this._numSubnets));
        this._availableSubnets.push(...this._allSubnets);
    }
}
//# sourceMappingURL=subnet-pool.js.map