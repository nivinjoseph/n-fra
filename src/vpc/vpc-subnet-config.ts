import { VpcAz } from "./vpc-az";
import { VpcSubnetType } from "./vpc-subnet-type";


export interface VpcSubnetConfig
{
    name: string;
    type: VpcSubnetType;
    cidrOctet3: number;
    az: VpcAz;
}