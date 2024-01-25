import { VpcAz } from "./vpc-az.js";
import { VpcSubnetType } from "./vpc-subnet-type.js";


export interface VpcSubnetConfig
{
    name: string;
    type: VpcSubnetType;
    cidrOctet3: number;
    az: VpcAz;
}