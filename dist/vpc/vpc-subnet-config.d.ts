import { VpcAz } from "./vpc-az.js";
import { VpcSubnetType } from "./vpc-subnet-type.js";
/**
 * The value of `VpcSubnetConfig.prefix`. Every other module's `subnetNamePrefix`, `ingressSubnetNamePrefixes`,
 * `egressSubnetNamePrefixes` and `dbSubnetNamePrefix` field must name one of these prefixes. Matching is by
 * `startsWith`, so `"private"` selects both `"private-app"` and `"private-db"`; a prefix that matches no subnet
 * throws when the resource is provisioned. `VpcProvisioner` requires each prefix to contain the word `public`,
 * `private` or `isolated`, and each subnet `name` to start with its prefix.
 */
export type SubnetNamePrefix = string;
export interface VpcSubnetConfig {
    /** Unique subnet name; must start with `prefix`, e.g. `"private-app-a"`. */
    name: string;
    /** `Public` routes to the internet gateway, `Private` routes out through NAT, `Isolated` has no internet route. */
    type: VpcSubnetType;
    /** Subnet CIDR inside the VPC range, unique across subnets. */
    cidrRange: string;
    /** Zone letter within the stack's region. Valid letters: `a`, `b`, `d` in ca-central-1, otherwise `a`, `b`, `c` (`NfraConfig.awsRegionAzs`). */
    az: VpcAz;
    /** Grouping key other modules refer to. Must contain the word `public`, `private` or `isolated`, e.g. `"private-app"`. */
    prefix: SubnetNamePrefix;
}
//# sourceMappingURL=vpc-subnet-config.d.ts.map