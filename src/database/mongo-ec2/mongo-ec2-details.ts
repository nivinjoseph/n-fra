import { ServiceAppDetails } from "../../app/service/service-app-details.js";


export interface MongoEc2Details extends ServiceAppDetails
{
    username: string;
    password: string;
}