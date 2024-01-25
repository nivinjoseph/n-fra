import { VpcDetails } from "../../vpc/vpc-details.js";


export interface MemorydbConfig
{
    vpcDetails: VpcDetails;
    subnetNamePrefix: string;
    ingressSubnetNamePrefixes: ReadonlyArray<string>;
    /**
     * @description Supported node types https://docs.aws.amazon.com/memorydb/latest/devguide/nodes.supportedtypes.html
     */
    nodeType: string;
    numShards?: number;
}