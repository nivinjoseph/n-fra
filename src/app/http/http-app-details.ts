import { AppDetails } from "../app-details.js";


export interface HttpAppDetails extends AppDetails
{
    host: string;
    port: number;
}