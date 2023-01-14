import { AppDetails } from "../app-details";


export interface GrpcAppDetails extends AppDetails
{
    host: string;
    port: number;
}