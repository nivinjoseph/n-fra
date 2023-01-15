import { Secret } from "./secret";
export declare class SecretsCache {
    private static readonly _map;
    /**
     * @static
     */
    private constructor();
    static contains(name: string): boolean;
    static store(secret: Secret): void;
    static retrieve(name: string): Secret;
}
