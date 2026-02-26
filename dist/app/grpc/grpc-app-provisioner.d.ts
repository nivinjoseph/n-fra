import { AppProvisioner } from "../app-provisioner.js";
import type { GrpcAppConfig } from "./grpc-app-config.js";
import type { GrpcAppDetails } from "./grpc-app-details.js";
export declare class GrpcAppProvisioner extends AppProvisioner<GrpcAppConfig, GrpcAppDetails> {
    constructor(name: string, config: GrpcAppConfig);
    protected provisionApp(): GrpcAppDetails;
}
//# sourceMappingURL=grpc-app-provisioner.d.ts.map