import * as Pulumi from "@pulumi/pulumi";
import { EnvType } from "../index.js";
import { given } from "@nivinjoseph/n-defensive";
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
                    reject(`Stack output for stack '${env}' not found`);
                    return;
                }
                resolve(output);
            });
        });
    }
}
//# sourceMappingURL=environment-provisioner.js.map