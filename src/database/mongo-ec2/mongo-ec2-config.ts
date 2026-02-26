import { Schema } from "@nivinjoseph/n-util";
import { ServiceAppConfig } from "../../app/service/service-app-config.js";


export type MongoEc2Config = Schema<ServiceAppConfig,
    "vpcDetails" | "subnetNamePrefix" | "ingressSubnetNamePrefixes" | "datadogConfig" |
    "computeProfile" | "volumeSize"> & {
        mongoDbVersion?: MongodbVersion;
        mongoUsername?: string;
        mongoPassword?: string;
    };


export enum MongodbVersion
{
    mongodb5_0 = "5.0.24"
}