import * as Pulumi from "@pulumi/pulumi";
export declare abstract class Logger {
    /**
     * @static
     */
    private constructor();
    static logInfo(info: string | Pulumi.Output<string | number>): Promise<void>;
    static logWarning(warning: string | Pulumi.Output<string | number>): Promise<void>;
    static logError(error: string | Error): Promise<void>;
}
//# sourceMappingURL=logger.d.ts.map