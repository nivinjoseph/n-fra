import { EnvType } from "./env-type.js";
import * as Pulumi from "@pulumi/pulumi";
import { given } from "@nivinjoseph/n-defensive";
// import { Tags } from "@pulumi/aws";
import * as aws from "@pulumi/aws";


export class NfraConfig
{
    private static readonly _pulumiAwsConfig = new Pulumi.Config("aws");
    private static readonly _pulumiAppConfig = new Pulumi.Config("nfra");
    private static _userTags: aws.Tags | null = null;
    
    public static get awsAccount(): string
    {
        const ids = this._pulumiAwsConfig.require("allowedAccountIds").toString();
        const numbers = "0123456789".split("");
        const id = ids.split("").filter(t => numbers.contains(t)).join("");
        if (id.length !== 12)
            throw new Error(`Invalid AWS account id ${id}`);
        return id;
        
        // return ids.trim().substring(1, ids.length - 1);
    }
    
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
        return this._pulumiAppConfig.get(key)?.toString() ?? null;
    }
    
    public static requireConfig(key: string): string
    {
        return this._pulumiAppConfig.require(key).toString();
    }
}