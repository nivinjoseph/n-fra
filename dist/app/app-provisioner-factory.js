import { GrpcAppProvisioner } from "./grpc/grpc-app-provisioner.js";
import { HttpAppProvisioner } from "./http/http-app-provisioner.js";
import { WorkerAppProvisioner } from "./worker/worker-app-provisioner.js";
export class AppProvisionerFactory {
    /**
     * @static
     */
    constructor() { }
    static provisionHttpApp(name, config) {
        const provisioner = new HttpAppProvisioner(name, config);
        return provisioner.provision();
    }
    static provisionGrpcApp(name, config) {
        const provisioner = new GrpcAppProvisioner(name, config);
        return provisioner.provision();
    }
    static provisionWorkerApp(name, config) {
        const provisioner = new WorkerAppProvisioner(name, config);
        return provisioner.provision();
    }
}
//# sourceMappingURL=app-provisioner-factory.js.map