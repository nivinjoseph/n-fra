import { LambdaDetails } from "./lambda-details.js";
import * as Pulumi from "@pulumi/pulumi";


export interface LambdaAccessConfig
{
    lambdaDetails: LambdaDetails;
    userOrRoleArn?: Pulumi.Output<string>;
    awsService?: string;
}