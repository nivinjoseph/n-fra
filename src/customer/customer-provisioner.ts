import { NfraConfig } from "../common/nfra-config.js";
import * as Path from "node:path";
import { EnvironmentProvisioner } from "./environment-provisioner.js";
import { given } from "@nivinjoseph/n-defensive";


export class CustomerProvisioner
{
    private readonly _customer: string;
    
    
    public constructor()
    {
        const customer = NfraConfig.project;    
        given(customer, "customer").ensureHasValue().ensureIsString();
        this._customer = customer;
    }
    
    
    public async provision(): Promise<any>
    {
        const filename = `${NfraConfig.env}.js`;
        const workdir = process.cwd();
        // console.warn("WORKDIR =>", workdir);
        given(workdir, "workdir").ensureHasValue().ensureIsString()
            .ensure(t => t.endsWith(`/${this._customer}`),
                `must be in the ${this._customer} folder`);
        const filepath = Path.join(workdir, "envs", filename);
        const mod = await import(filepath);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const envProvisioner = new mod.default() as EnvironmentProvisioner<any>;
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