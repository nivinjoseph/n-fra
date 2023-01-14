import { AppSecret } from "../secrets/app-secret";
export interface AppDatadogConfig {
    ddHost: string;
    apiKey: AppSecret;
}
