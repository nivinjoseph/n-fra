import { Secret } from "../secrets/secret.js";


export interface AppDatadogConfig
{
    ddHost: string;
    apiKey: Secret;
}