import * as Pulumi from "@pulumi/pulumi";
import { EnvType } from "../common/env-type.js";
export type EnvironmentOutput = {
    [key: string]: Pulumi.Output<any>;
};
/**
 * Base class for one environment's infrastructure. Subclass it, implement `provisionEnvironment()`, and `export default` the class
 * from `envs/<stack>.ts` so `CustomerProvisioner` can load it. Export its result from the Pulumi program as `stackOutput`:
 * `fetchEnvironmentOutput(env)` reads exactly that output name from another stack of the same project.
 */
export declare abstract class EnvironmentProvisioner<T extends EnvironmentOutput> {
    constructor();
    provision(): Promise<T>;
    protected abstract provisionEnvironment(): Promise<T>;
    protected fetchEnvironmentOutput<U>(env: EnvType): Promise<U>;
}
//# sourceMappingURL=environment-provisioner.d.ts.map