import { AppConfig } from "../app-config";
import * as Pulumi from "@pulumi/pulumi";


export interface HttpAppConfig extends AppConfig
{
    ingressSubnetNamePrefixes: ReadonlyArray<string>;
    healthCheckPath: string;
    minCapacity: number;
    maxCapacity: number;
    albTargetGroupArn?: Pulumi.Output<string>;
}