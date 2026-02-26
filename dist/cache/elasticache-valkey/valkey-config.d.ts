import { VpcDetails } from "../../vpc/vpc-details.js";
export interface ValkeyConfig {
    vpcDetails: VpcDetails;
    subnetNamePrefix: string;
    ingressSubnetNamePrefixes: ReadonlyArray<string>;
    /**
     * @description Supported node types https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/CacheNodes.SupportedTypes.html
     */
    nodeType: string;
    isHA?: boolean;
}
//# sourceMappingURL=valkey-config.d.ts.map