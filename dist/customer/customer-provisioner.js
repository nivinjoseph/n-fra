import { NfraConfig } from "../common/nfra-config.js";
import * as Path from "node:path";
import { given } from "@nivinjoseph/n-defensive";
export class CustomerProvisioner {
    constructor() {
        const customer = NfraConfig.project;
        given(customer, "customer").ensureHasValue().ensureIsString();
        this._customer = customer;
    }
    async provision() {
        const filename = `${NfraConfig.env}.js`;
        const workdir = process.cwd();
        // console.warn("WORKDIR =>", workdir);
        given(workdir, "workdir").ensureHasValue().ensureIsString()
            .ensure(t => t.endsWith(`/${this._customer}`), `must be in the ${this._customer} folder`);
        const filepath = Path.join(workdir, "envs", filename);
        const mod = await import(filepath);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const envProvisioner = new mod.default();
        const result = await envProvisioner.provision();
        return result;
        // this._deployEnvironment().catch(e =>
        // {
        //     console.error(e);
        //     // eslint-disable-next-line @typescript-eslint/no-floating-promises
        //     Logger.logWarning("Failure!!");
        //     // eslint-disable-next-line @typescript-eslint/no-floating-promises
        //     Logger.logError(e);
        //     process.exit(1);
        // });
    }
}
//# sourceMappingURL=customer-provisioner.js.map