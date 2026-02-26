import type { AppConfig } from "../app-config.js";


export interface GrpcAppConfig extends AppConfig
{
    ingressSubnetNamePrefixes: ReadonlyArray<string>;
    // healthCheckPath: string;
}