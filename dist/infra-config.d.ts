import { EnvType } from "./env-type";
import { Tags } from "@pulumi/aws";
export declare class InfraConfig {
    private static readonly _pulumiAwsConfig;
    private static readonly _pulumiAppConfig;
    private static _userTags;
    static get awsAccount(): string;
    static get awsRegion(): string;
    static get env(): EnvType;
    static get tags(): Tags;
    static get ecr(): string;
    private constructor();
    static configureTags(tags: Record<string, string>): void;
    static getConfig(key: string): string | null;
    static requireConfig(key: string): string;
}
