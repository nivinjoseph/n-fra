import { AppSecret } from "./app-secret";
export declare class SecretsCache {
    private static readonly _map;
    /**
     * @static
     */
    private constructor();
    static contains(name: string): boolean;
    static store(secret: AppSecret): void;
    static retrieve(name: string): AppSecret;
}
