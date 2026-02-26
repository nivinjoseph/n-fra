import { VpcDetails } from "../../vpc/vpc-details.js";


export interface KafkaMskProvisionedConfig
{
    vpcDetails: VpcDetails;
    subnetNamePrefix: string;
    ingressSubnetNamePrefixes: ReadonlyArray<string>;
    numBrokers: 2 | 3;
    instanceClass: string;
    storageGb: number;
    makePublic?: boolean;
}