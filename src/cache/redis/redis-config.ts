import { VpcDetails } from "../../vpc/vpc-details.js";


export interface RedisConfig
{
    vpcDetails: VpcDetails;
    subnetNamePrefix: string;
    ingressSubnetNamePrefixes: ReadonlyArray<string>;
    /**
     * @description Supported node types https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/CacheNodes.SupportedTypes.html
     */
    nodeType: string;
}