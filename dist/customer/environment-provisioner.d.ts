import * as Pulumi from "@pulumi/pulumi";
import { EnvType } from "../index.js";
export type EnvironmentOutput = {
    [key: string]: Pulumi.Output<any>;
};
export declare abstract class EnvironmentProvisioner<T extends EnvironmentOutput> {
    constructor();
    provision(): Promise<T>;
    protected abstract provisionEnvironment(): Promise<T>;
    protected fetchEnvironmentOutput<U>(env: EnvType): Promise<U>;
}
//# sourceMappingURL=environment-provisioner.d.ts.map