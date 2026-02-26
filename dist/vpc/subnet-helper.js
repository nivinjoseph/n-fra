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
    static calculateSubnets(cidrRange, numSubnets) {
        given(cidrRange, "cidrRange").ensureHasValue().ensureIsString()
            .ensure(t => this.validateCidrRange(t));
        cidrRange = cidrRange.trim();
        given(numSubnets, "numSubnets").ensureHasValue().ensureIsNumber()
            .ensure(t => t >= 1 && t <= 1024);
        // 203.0.113.0/24
        // 8
        const matrix = [
            // Bits  Networks  Hosts
            [0, 1, 0],
            [1, 2, 0],
            [2, 4, 2],
            [3, 8, 6],
            [4, 16, 14],
            [5, 32, 30],
            [6, 64, 62],
            [7, 128, 126],
            [8, 256, 254],
            [9, 512, 510],
            [9, 1024, 1022]
        ];
        // 3
        const slotIndex = matrix.findIndex(t => t[1] >= numSubnets);
        // console.log("slot index", slotIndex);
        if (slotIndex === -1)
            throw new ArgumentException("numNetworks", "value is too high 1");
        // [3, 8, 6]
        const slot = matrix[slotIndex];
        // 3
        const bitsToBorrow = slot[0];
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
            throw new ArgumentException("numNetworks", "value is too high 2");
        // 11111111 11111111 11111111 11100000
        const newSubnetMask = [
            ...cidrIpBinary.take(cidrNetworkBitsCount + bitsToBorrow).map(_ => "1"),
            ...cidrIpBinary.skip(cidrNetworkBitsCount + bitsToBorrow).map(_ => "0")
        ];
        // 27
        const newCidrNetworkBitsCount = newSubnetMask.count(t => t === "1");
        const networks = new Array();
        for (let i = 0; i < slot[1]; i++) {
            const networkAddress = [
                ...cidrIpBinary.take(cidrNetworkBitsCount),
                ...this.convertDecimalToBinary(i).split("").reverse().take(bitsToBorrow).reverse(),
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
        catch (_a) {
            return false;
        }
    }
}
//# sourceMappingURL=subnet-helper.js.map