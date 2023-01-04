import { EnvType } from "./env-type";
import * as pulumi from "@pulumi/pulumi";
import { given } from "@nivinjoseph/n-defensive";
import { Tags } from "@pulumi/aws";


export class InfraConfig
{
    public static get env(): EnvType
    { 
        const env = pulumi.getStack() as EnvType;
        
        given(env, "env").ensureHasValue().ensureIsEnum(EnvType);
        
        return env;
    }
    
    public static get tags(): Tags
    {
        return {
            provisioner: "pulumi-iac",
            env: this.env
        };
    }
    
    private constructor() { }
}