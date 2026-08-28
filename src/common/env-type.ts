import { given } from "@nivinjoseph/n-defensive";
import { NfraConfig } from "../../dist/index.js";

export enum EnvType
{
    dev = "dev",
    test = "test",
    stage = "stage",
    prod = "prod"
}

export function isEnv(env: EnvType): boolean
{
    given(env, "env").ensureHasValue().ensureIsEnum(EnvType);
    
    return NfraConfig.env === env;
}