import { VpcDetails } from "../../vpc/vpc-details.js";


export interface Aspv2Config
{
    vpcDetails: VpcDetails;
    subnetNamePrefix: string;
    ingressSubnetNamePrefixes: ReadonlyArray<string>;
    databaseName: string;
    minCapacity: number;
    maxCapacity: number;
    deletionProtection: boolean;
    skipFinalSnapshot: boolean;
}