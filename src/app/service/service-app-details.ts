import { AppDetails } from "../app-details.js";


export interface ServiceAppDetails extends AppDetails
{
    host: string;
    port: number;
}