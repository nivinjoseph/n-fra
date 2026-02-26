import { given } from "@nivinjoseph/n-defensive";
import { NfraConfig } from "./nfra-config.js";


export abstract class CommonHelper
{
    private constructor() { }
    
    
    public static prefixName(name: string): string
    {
        given(name, "name").ensureHasValue().ensureIsString();
        name = name.trim();
        
        const prefix = `${NfraConfig.project}-${NfraConfig.env}`;
        if (!name.startsWith(prefix))
            name = `${prefix}-${name}`;
        
        return name;
    }
}