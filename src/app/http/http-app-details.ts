import { AppDetails } from "../app-details";


export interface HttpAppDetails extends AppDetails
{
    host: string;
    port: number;
}