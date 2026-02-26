import { VpcDetails } from "../../vpc/vpc-details.js";


export interface MongoDocumentdbConfig
{
    vpcDetails: VpcDetails;
    subnetNamePrefix: string;
    ingressSubnetNamePrefixes: ReadonlyArray<string>;
    username: string;
    password: string;
}