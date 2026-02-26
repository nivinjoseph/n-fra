import { AppDetails } from "../../app/app-details.js";
import * as Pulumi from "@pulumi/pulumi";


export interface MongoFargateDetails extends AppDetails
{
    host: string;
    port: number;
    username: string;
    password: string;
    nlbHost?: Pulumi.Output<string>;
}