import { VpcDetails } from "../../vpc/vpc-details";


export interface Aspv1Config
{
    vpcDetails: VpcDetails;
    subnetNamePrefix: string;
    ingressSubnetNamePrefixes: ReadonlyArray<string>;
    databaseName: string;
    minCapacity: number;
    maxCapacity: number;
    autoPause: boolean;
    deletionProtection: boolean;
    skipFinalSnapshot: boolean;
}