import { VpcDetails } from "../../vpc/vpc-details.js";


export interface RabbitCloudAmqpConfig
{
    vpcDetails: VpcDetails;
    cloudAmqpVpcEndpointServiceName: string;
    cloudAmqpHost: string;
    cloudAmqpUsername: string;
    cloudAmqpPassword: string;
}