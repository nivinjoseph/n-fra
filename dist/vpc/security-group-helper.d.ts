import { VpcDetails } from "./vpc-details.js";
import * as Pulumi from "@pulumi/pulumi";
export declare class SecurityGroupHelper {
    /**
     * @static
     */
    private constructor();
    static resolveCidrBlocks(vpcDetails: VpcDetails, subnetNamePrefixesOrCidrs: ReadonlyArray<string>): Pulumi.Output<Array<string>>;
    static createSecurityGroup(name: string, vpcDetails: VpcDetails, ingress: ReadonlyArray<SecurityGroupTrafficConfig>, egress: ReadonlyArray<SecurityGroupTrafficConfig>): SecurityGroupDetails;
}
export interface SecurityGroupTrafficConfig {
    protocol: string;
    fromPort: number;
    toPort: number;
    subnetNamePrefixesOrCidrs: ReadonlyArray<string>;
}
export interface SecurityGroupDetails {
    name: Pulumi.Output<string>;
    id: Pulumi.Output<string>;
    arn: Pulumi.Output<string>;
}
//# sourceMappingURL=security-group-helper.d.ts.map