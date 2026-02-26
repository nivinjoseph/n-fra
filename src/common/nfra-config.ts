import { EnvType } from "./env-type.js";
import * as Pulumi from "@pulumi/pulumi";
import { given } from "@nivinjoseph/n-defensive";
// import { Tags } from "@pulumi/aws";
import * as aws from "@pulumi/aws";
import { VpcAz } from "../vpc/vpc-az.js";


export class NfraConfig
{
    private static readonly _pulumiAwsConfig = new Pulumi.Config("aws");
    private static readonly _pulumiAppConfig = new Pulumi.Config("nfra");
    private static _userTags: aws.Tags = {};
    private static _appEnvOverride: (() => string) | null = null;
    private static _ecrAwsAccountIdOverride: (() => string) | null = null;
    private static _ecrAwsRegionOverride: (() => string) | null = null;

    public static get awsAccount(): string
    {
        const ids = this._pulumiAwsConfig.require("allowedAccountIds").toString();
        const numbers = "0123456789".split("");
        const id = ids.split("").filter(t => numbers.contains(t)).join("");
        if (id.length !== 12)
            throw new Error(`Invalid AWS account id ${id}`);
        return id;
    }

    public static get awsRegion(): string { return this._pulumiAwsConfig.require("region"); }

    public static get awsRegionAzs(): Array<VpcAz>
    {
        return this.awsRegion === "ca-central-1" ? [VpcAz.a, VpcAz.b, VpcAz.d] : [VpcAz.a, VpcAz.b, VpcAz.c];
    }

    public static get awsRegionAvailabilityZones(): Array<string>
    {
        return this.awsRegionAzs.map(t => `${this.awsRegion}${t}`);
    }

    public static get project(): string { return Pulumi.getProject(); }

    public static get env(): EnvType
    {
        const env = Pulumi.getStack() as EnvType;

        given(env, "env").ensureHasValue().ensureIsEnum(EnvType);

        return env;
    }

    public static get appEnv(): string
    {
        return this._appEnvOverride != null ? this._appEnvOverride() : this.env;
    }

    public static get tags(): aws.Tags
    {
        return {
            provisioner: "n-fra",
            env: this.appEnv,
            ...this._userTags
        };
    }

    public static get ecrBase(): string
    {
        return `${this.ecrAwsAccountId}.dkr.ecr.${this.ecrAwsRegion}.amazonaws.com`;
    }

    public static get ecrAwsAccountId(): string
    {
        return this._ecrAwsAccountIdOverride != null ? this._ecrAwsAccountIdOverride() : this.awsAccount;
    }

    public static get ecrAwsRegion(): string
    {
        return this._ecrAwsRegionOverride != null ? this._ecrAwsRegionOverride() : this.awsRegion;
    }


    private constructor() { }


    public static configureTags(tags: Record<string, string>): void
    {
        given(tags, "tags").ensureHasValue().ensureIsObject();

        this._userTags = tags;
    }

    public static getConfig(key: string): string | null
    {
        return this._pulumiAppConfig.get(key)?.toString() ?? null;
    }

    public static requireConfig(key: string): string
    {
        return this._pulumiAppConfig.require(key).toString();
    }

    public static configureAppEnvOverride(func: () => string): void
    {
        given(func, "func").ensureHasValue().ensureIsFunction();

        this._appEnvOverride = func;
    }

    public static configureEcrAwsAccountIdOverride(func: () => string): void
    {
        given(func, "func").ensureHasValue().ensureIsFunction();

        this._ecrAwsAccountIdOverride = func;
    }

    public static configureEcrAwsRegionOverride(func: () => string): void
    {
        given(func, "func").ensureHasValue().ensureIsFunction();

        this._ecrAwsRegionOverride = func;
    }
}