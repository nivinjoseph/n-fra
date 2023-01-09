import { EnvType } from "./env-type";
import * as pulumi from "@pulumi/pulumi";
import { given } from "@nivinjoseph/n-defensive";
import { Tags } from "@pulumi/aws";


export class InfraConfig
{
    private static readonly _pulumiAwsConfig = new pulumi.Config("aws");
    private static _userTags: Tags | null = null;
    
    public static get awsAccount(): string { return this._pulumiAwsConfig.require("account"); }
    public static get awsRegion(): string { return this._pulumiAwsConfig.require("region"); }
    
    public static get env(): EnvType
    { 
        const env = pulumi.getStack() as EnvType;
        
        given(env, "env").ensureHasValue().ensureIsEnum(EnvType);
        
        return env;
    }
    
    public static get tags(): Tags
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
}