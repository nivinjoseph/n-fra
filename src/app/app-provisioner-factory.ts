import { GrpcAppConfig } from "./grpc/grpc-app-config.js";
import { GrpcAppDetails } from "./grpc/grpc-app-details.js";
import { GrpcAppProvisioner } from "./grpc/grpc-app-provisioner.js";
import { HttpAppConfig } from "./http/http-app-config.js";
import { HttpAppDetails } from "./http/http-app-details.js";
import { HttpAppProvisioner } from "./http/http-app-provisioner.js";
import { WorkerAppConfig } from "./worker/worker-app-config.js";
import { WorkerAppDetails } from "./worker/worker-app-details.js";
import { WorkerAppProvisioner } from "./worker/worker-app-provisioner.js";


export class AppProvisionerFactory
{
    /**
     * @static
     */
    private constructor() { }
    
    
    public static provisionHttpApp(name: string, config: HttpAppConfig): Promise<HttpAppDetails>
    {
        const provisioner = new HttpAppProvisioner(name, config);
        return provisioner.provision();
    }
    
    public static provisionGrpcApp(name: string, config: GrpcAppConfig): Promise<GrpcAppDetails>
    {
        const provisioner = new GrpcAppProvisioner(name, config);
        return provisioner.provision();
    }
    
    public static provisionWorkerApp(name: string, config: WorkerAppConfig): Promise<WorkerAppDetails>
    {
        const provisioner = new WorkerAppProvisioner(name, config);
        return provisioner.provision();
    }
}