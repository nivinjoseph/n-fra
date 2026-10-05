/**
 * Entry point of a Pulumi program. `provision()` requires the working directory to end with the Pulumi project name and dynamically
 * imports `./envs/<stack>.js` (the compiled `envs/<stack>.ts`), whose default export must be a zero-argument `EnvironmentProvisioner` subclass.
 */
export declare class CustomerProvisioner {
    private readonly _customer;
    constructor();
    provision(): Promise<any>;
}
//# sourceMappingURL=customer-provisioner.d.ts.map