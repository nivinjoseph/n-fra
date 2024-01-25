import { AppDetails } from "../app-details.js";


export interface GrpcAppDetails extends AppDetails
{
    host: string;
    port: number;
}