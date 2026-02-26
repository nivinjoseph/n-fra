import { EnvType } from "./env-type.js";
import * as aws from "@pulumi/aws";
import { VpcAz } from "../vpc/vpc-az.js";
export declare class NfraConfig {
    private static readonly _pulumiAwsConfig;
    private static readonly _pulumiAppConfig;
    private static _userTags;
    private static _appEnvOverride;
    private static _ecrAwsAccountIdOverride;
    private static _ecrAwsRegionOverride;
    static get awsAccount(): string;
    static get awsRegion(): string;
    static get awsRegionAzs(): Array<VpcAz>;
    static get awsRegionAvailabilityZones(): Array<string>;
    static get project(): string;
    static get env(): EnvType;
    static get appEnv(): string;
    static get tags(): aws.Tags;
    static get ecrBase(): string;
    static get ecrAwsAccountId(): string;
    static get ecrAwsRegion(): string;
    private constructor();
    static configureTags(tags: Record<string, string>): void;
    static getConfig(key: string): string | null;
    static requireConfig(key: string): string;
    static configureAppEnvOverride(func: () => string): void;
    static configureEcrAwsAccountIdOverride(func: () => string): void;
    static configureEcrAwsRegionOverride(func: () => string): void;
}
//# sourceMappingURL=nfra-config.d.ts.map