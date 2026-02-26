import * as Pulumi from "@pulumi/pulumi";


export abstract class Logger
{
    /**
     * @static
     */
    private constructor() { }
    
    
    // public static logDebug(debug: string): Promise<void>
    // {
    //     return Pulumi.log.debug(debug);
    // }
    
    public static logInfo(info: string | Pulumi.Output<string | number>): Promise<void>
    {
        if (typeof info === "string")
            return Pulumi.log.info(info).catch(e => console.error(e));
        else
        {
            info.apply(t => Pulumi.log.info(t.toString())
                .catch(e => console.error(e)));
            return Promise.resolve();
        }
    }
    
    public static logWarning(warning: string | Pulumi.Output<string | number>): Promise<void>
    {
        if (typeof warning === "string")
            return Pulumi.log.info(warning).catch(e => console.error(e));
        else
        {
            warning.apply(t => Pulumi.log.info(t.toString())
                .catch(e => console.error(e)));
            return Promise.resolve();
        }
    }
    
    public static logError(error: string | Error): Promise<void>
    {
        return Pulumi.log.error(error as any).catch(e => console.error(e));
    }
}