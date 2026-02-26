import { VpcDetails } from "../../vpc/vpc-details.js";


export interface EfsConfig
{
    vpcDetails: VpcDetails;
    subnetNamePrefix: string;
    ingressSubnetNamePrefixes: ReadonlyArray<string>;
    useMaxIoPerformanceMode?: boolean;
}