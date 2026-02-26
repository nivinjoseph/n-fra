import * as Pulumi from "@pulumi/pulumi";
export class Logger {
    /**
     * @static
     */
    constructor() { }
    // public static logDebug(debug: string): Promise<void>
    // {
    //     return Pulumi.log.debug(debug);
    // }
    static logInfo(info) {
        if (typeof info === "string")
            return Pulumi.log.info(info).catch(e => console.error(e));
        else {
            info.apply(t => Pulumi.log.info(t.toString())
                .catch(e => console.error(e)));
            return Promise.resolve();
        }
    }
    static logWarning(warning) {
        if (typeof warning === "string")
            return Pulumi.log.info(warning).catch(e => console.error(e));
        else {
            warning.apply(t => Pulumi.log.info(t.toString())
                .catch(e => console.error(e)));
            return Promise.resolve();
        }
    }
    static logError(error) {
        return Pulumi.log.error(error).catch(e => console.error(e));
    }
}
//# sourceMappingURL=logger.js.map