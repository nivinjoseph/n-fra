import * as Pulumi from "@pulumi/pulumi";
import { EnvType } from "../index.js";
import { given } from "@nivinjoseph/n-defensive";


export type EnvironmentOutput = {
    [key: string]: Pulumi.Output<any>;
};

export abstract class EnvironmentProvisioner<T extends EnvironmentOutput>
{
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor, @typescript-eslint/no-empty-function
    public constructor() { }
    
    
    public provision(): Promise<T>
    {
        return this.provisionEnvironment();
    }
    
    protected abstract provisionEnvironment(): Promise<T>;
    
    protected fetchEnvironmentOutput<U>(env: EnvType): Promise<U>
    {
        given(env, "env").ensureHasValue().ensureIsEnum(EnvType);
        
        // https://github.com/pulumi/pulumi/issues/9308
        const stackRef = new Pulumi.StackReference(env);
        
        return new Promise((resolve, reject) =>
        {
            stackRef.getOutput("stackOutput")
                .apply(output =>
                {
                    if (output == null)
                    {
                        reject(`Stack output for stack '${env}' not found`);
                        return;
                    }
                    resolve(output);
                });
        });
    }
}