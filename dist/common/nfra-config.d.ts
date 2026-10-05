import { EnvType } from "./env-type.js";
import * as aws from "@pulumi/aws";
import { VpcAz } from "../vpc/vpc-az.js";
/**
 * Process-wide settings read from the Pulumi program. Requirements:
 * - the stack name must be one of `dev`, `test`, `stage`, `prod` (`EnvType`); several defaults switch on `prod`;
 * - Pulumi config `aws:region` is required, and `aws:allowedAccountIds` (a single 12-digit account) whenever ECR images or the
 *   Datadog integration are used;
 * - optional `nfra:<key>` config values are read through `getConfig` / `requireConfig`.
 * Call the `configure*` methods before constructing any provisioner: tags and overrides are read when resources are created.
 */
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