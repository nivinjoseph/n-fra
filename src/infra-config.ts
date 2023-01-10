import { EnvType } from "./env-type";
import * as Pulumi from "@pulumi/pulumi";
import { given } from "@nivinjoseph/n-defensive";
// import { Tags } from "@pulumi/aws";
import * as aws from "@pulumi/aws";


export class InfraConfig
{
    private static readonly _pulumiAwsConfig = new Pulumi.Config("aws");
    private static readonly _pulumiAppConfig = new Pulumi.Config("nfra");
    private static _userTags: aws.Tags | null = null;
    
    public static get awsAccount(): string { return this._pulumiAwsConfig.require("allowedAccountIds"); }
    public static get awsRegion(): string { return this._pulumiAwsConfig.require("region"); }
    
    public static get env(): EnvType
    { 
        const env = Pulumi.getStack() as EnvType;
        
        given(env, "env").ensureHasValue().ensureIsEnum(EnvType);
        
        return env;
    }
    
    public static get tags(): aws.Tags
    {
        return {
            provisioner: "n-fra",
            env: this.env,
            ...this._userTags
        };
    }
    
    public static get ecr(): string
    {
        return `${this.awsAccount}.dkr.ecr.${this.awsRegion}.amazonaws.com`;
    }
    
    
    private constructor() { }
    
    
    public static configureTags(tags: Record<string, string>): void
    {
        given(tags, "tags").ensureHasValue().ensureIsObject();
        
        this._userTags = tags;
    }
    
    public static getConfig(key: string): string | null
    {
        return this._pulumiAppConfig.get(key) ?? null;
    }
    
    public static requireConfig(key: string): string
    {
        return this._pulumiAppConfig.require(key);
    }
}