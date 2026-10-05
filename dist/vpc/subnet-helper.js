import { given } from "@nivinjoseph/n-defensive";
import { ArgumentException } from "@nivinjoseph/n-exception";
import { TypeHelper } from "@nivinjoseph/n-util";
// type PlaceHolder = [number, number, number, number, number, number, number, number];
const placeHolder = [128, 64, 32, 16, 8, 4, 2, 1];
export class SubnetHelper {
    static convertBinaryToDecimal(input) {
        const byte = input.trim().split("")
            .map(t => Number.parseInt(t));
        return byte.reduce((acc, bit, index) => {
            const place = placeHolder[index];
            acc += place * bit;
            return acc;
        }, 0);
    }
    static convertDecimalToBinary(input) {
        const result = [0, 0, 0, 0, 0, 0, 0, 0];
        placeHolder.reduce((acc, place, index) => {
            if (place <= acc) {
                acc -= place;
                result[index] = 1;
            }
            else {
                result[index] = 0;
            }
            return acc;
        }, Number.parseInt(input.toString()));
        return result.map(t => t.toString()).join("");
    }
    /**
     * Splits `cidrRange` into equal subnets: the smallest power of two that is at least `numSubnets`, in address order.
     * The only limit is the host bits of the range (a `/16` holds up to 65536 `/32` entries); host bits set in
     * `cidrRange` itself are ignored.
     *
     * @throws ArgumentException when `cidrRange` has fewer host bits than the count needs.
     */
    static calculateSubnets(cidrRange, numSubnets) {
        given(cidrRange, "cidrRange").ensureHasValue().ensureIsString()
            .ensure(t => this.validateCidrRange(t));
        cidrRange = cidrRange.trim();
        given(numSubnets, "numSubnets").ensureHasValue().ensureIsNumber()
            .ensure(t => Number.isInteger(t) && t >= 1, "must be a positive integer");
        // 203.0.113.0/24
        // 8
        // 3 (bits for the smallest power of two that is at least numSubnets)
        let bitsToBorrow = 0;
        while (2 ** bitsToBorrow < numSubnets)
            bitsToBorrow++;
        // 8
        const networkCount = 2 ** bitsToBorrow;
        // console.log("bits to borrow", bitsToBorrow);
        // 203.0.113.0
        const cidrIp = cidrRange.split("/").takeFirst();
        // 24
        const cidrNetworkBitsCount = Number.parseInt(cidrRange.split("/").takeLast());
        // 11001011 00000000 01110001 00000000
        const cidrIpBinary = cidrIp.split(".")
            .map(t => this.convertDecimalToBinary(t))
            .reduce((acc, value) => {
            acc.push(...value.split(""));
            return acc;
        }, new Array());
        // 11111111 11111111 11111111 00000000
        // const _cidrIpSubnetMaskBinary = [
        //     ...cidrIpBinary.take(cidrNetworkBitsCount).map(_ => "1"),
        //     ...cidrIpBinary.skip(cidrNetworkBitsCount).map(_ => "0")
        // ];
        // 8
        const bitsAvailableToBorrow = 32 - cidrNetworkBitsCount;
        // console.log("variance", bitsToBorrow, bitsAvailableToBorrow);
        if (bitsToBorrow > bitsAvailableToBorrow)
            throw new ArgumentException("numSubnets", `${numSubnets} subnets need ${bitsToBorrow} subnet bits but ${cidrRange} only has ${bitsAvailableToBorrow} bits available`);
        // 11111111 11111111 11111111 11100000
        const newSubnetMask = [
            ...cidrIpBinary.take(cidrNetworkBitsCount + bitsToBorrow).map(_ => "1"),
            ...cidrIpBinary.skip(cidrNetworkBitsCount + bitsToBorrow).map(_ => "0")
        ];
        // 27
        const newCidrNetworkBitsCount = newSubnetMask.count(t => t === "1");
        const networks = new Array();
        for (let i = 0; i < networkCount; i++) {
            const indexBits = bitsToBorrow === 0 ? new Array() : i.toString(2).padStart(bitsToBorrow, "0").split("");
            const networkAddress = [
                ...cidrIpBinary.take(cidrNetworkBitsCount),
                ...indexBits,
                ...newSubnetMask.skip(newCidrNetworkBitsCount)
            ];
            const decimals = new Array();
            for (let j = 0; j < 4; j++) {
                const octet = networkAddress.skip(j * 8).take(8).join("");
                const decimal = this.convertBinaryToDecimal(octet);
                decimals.push(decimal);
            }
            networks.push(`${decimals.join(".")}/${newCidrNetworkBitsCount}`);
        }
        return networks;
    }
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
    static calculateLegacySubnets(cidrRange) {
        given(cidrRange, "cidrRange").ensureHasValue().ensureIsString()
            .ensure(t => this.validateCidrRange(t));
        cidrRange = cidrRange.trim();
        const legacySubnetBits = 9;
        const bitsAvailableToBorrow = 32 - this._parseCidr(cidrRange).prefixLength;
        if (bitsAvailableToBorrow < legacySubnetBits)
            throw new ArgumentException("cidrRange", `the legacy layout needs ${legacySubnetBits} subnet bits but ${cidrRange} only has ${bitsAvailableToBorrow} bits available`);
        return this.calculateSubnets(cidrRange, 256)
            .map(t => {
            const parts = t.split("/");
            return `${parts.takeFirst()}/${Number.parseInt(parts.takeLast()) + 1}`;
        });
    }
    /**
     * True when every address of `cidrRange` lies inside `parentCidrRange`; a range is inside itself.
     * Both arguments must be valid CIDR ranges.
     */
    static isCidrWithin(cidrRange, parentCidrRange) {
        given(cidrRange, "cidrRange").ensureHasValue().ensureIsString()
            .ensure(t => this.validateCidrRange(t));
        given(parentCidrRange, "parentCidrRange").ensureHasValue().ensureIsString()
            .ensure(t => this.validateCidrRange(t));
        const cidr = this._parseCidr(cidrRange);
        const parent = this._parseCidr(parentCidrRange);
        if (cidr.prefixLength < parent.prefixLength)
            return false;
        const parentBlockSize = 2 ** (32 - parent.prefixLength);
        return Math.floor(cidr.address / parentBlockSize) === Math.floor(parent.address / parentBlockSize);
    }
    static validateCidrRange(cidrRange) {
        try {
            given(cidrRange, "cidrRange").ensureHasValue().ensureIsString()
                .ensure(t => t.split("/").length === 2)
                .ensure(t => t.split("/")[0].split(".").length === 4)
                .ensure(t => t.split("/")[0].split(".")
                .map(u => TypeHelper.parseNumber(u)).every(u => u != null && u >= 0 && u <= 255))
                .ensure(t => TypeHelper.parseNumber(t.split("/")[1]) != null
                && TypeHelper.parseNumber(t.split("/")[1]) >= 0
                && TypeHelper.parseNumber(t.split("/")[1]) <= 32);
            return true;
        }
        catch {
            return false;
        }
    }
    static _parseCidr(cidrRange) {
        const parts = cidrRange.trim().split("/");
        const address = parts.takeFirst().split(".")
            .reduce((acc, octet) => acc * 256 + Number.parseInt(octet), 0);
        return { address, prefixLength: Number.parseInt(parts.takeLast()) };
    }
}
//# sourceMappingURL=subnet-helper.js.map