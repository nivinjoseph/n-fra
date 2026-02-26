import { GrpcAppConfig } from "./grpc/grpc-app-config.js";
import { GrpcAppDetails } from "./grpc/grpc-app-details.js";
import { HttpAppConfig } from "./http/http-app-config.js";
import { HttpAppDetails } from "./http/http-app-details.js";
import { WorkerAppConfig } from "./worker/worker-app-config.js";
import { WorkerAppDetails } from "./worker/worker-app-details.js";
export declare class AppProvisionerFactory {
    /**
     * @static
     */
    private constructor();
    static provisionHttpApp(name: string, config: HttpAppConfig): Promise<HttpAppDetails>;
    static provisionGrpcApp(name: string, config: GrpcAppConfig): Promise<GrpcAppDetails>;
    static provisionWorkerApp(name: string, config: WorkerAppConfig): Promise<WorkerAppDetails>;
}
//# sourceMappingURL=app-provisioner-factory.d.ts.map