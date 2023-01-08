import { AppSecret } from "./app-secret";
export declare class SecretsProvisioner {
    provision(name: string, value: string): AppSecret;
}
