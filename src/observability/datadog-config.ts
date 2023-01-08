import { AppSecret } from "../secrets/app-secret";


export interface DatadogConfig
{
    ddHost: string;
    apiKey: AppSecret;
}