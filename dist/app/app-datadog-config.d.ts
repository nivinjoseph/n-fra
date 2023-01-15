import { Secret } from "../secrets/secret";
export interface AppDatadogConfig {
    ddHost: string;
    apiKey: Secret;
}
