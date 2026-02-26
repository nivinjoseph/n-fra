import * as Pulumi from "@pulumi/pulumi";


export interface MongoDocumentdbDetails
{
    host: Pulumi.Output<string>;
    port: number;
    username: string;
    password: string;
}