import * as Pulumi from "@pulumi/pulumi";
import { EnvType } from "../common/env-type.js";
import { given } from "@nivinjoseph/n-defensive";
/**
 * Base class for one environment's infrastructure. Subclass it, implement `provisionEnvironment()`, and `export default` the class
 * from `envs/<stack>.ts` so `CustomerProvisioner` can load it. Export its result from the Pulumi program as `stackOutput`:
 * `fetchEnvironmentOutput(env)` reads exactly that output name from another stack of the same project.
 */
export class EnvironmentProvisioner {
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor, @typescript-eslint/no-empty-function
    constructor() { }
    provision() {
        return this.provisionEnvironment();
    }
    fetchEnvironmentOutput(env) {
        given(env, "env").ensureHasValue().ensureIsEnum(EnvType);
        // https://github.com/pulumi/pulumi/issues/9308
        const stackRef = new Pulumi.StackReference(env);
        return new Promise((resolve, reject) => {
            stackRef.getOutput("stackOutput")
                .apply(output => {
                if (output == null) {
                    reject(new Error(`Stack output for stack '${env}' not found`));
                    return;
                }
                resolve(output);
            });
        });
    }
}
//# sourceMappingURL=environment-provisioner.js.map