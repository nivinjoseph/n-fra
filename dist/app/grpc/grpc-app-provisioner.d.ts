import { AppProvisioner } from "../app-provisioner.js";
import type { GrpcAppConfig } from "./grpc-app-config.js";
import type { GrpcAppDetails } from "./grpc-app-details.js";
/**
 * Fargate service for a gRPC app reachable through ECS Service Connect. Container contract: listen on port 50051 and
 * implement the gRPC health protocol; the image must contain `/usr/local/bin/grpc-health-probe` for the ECS health check.
 */
export declare class GrpcAppProvisioner extends AppProvisioner<GrpcAppConfig, GrpcAppDetails> {
    private static readonly _probeConnectTimeoutSeconds;
    private static readonly _probeRpcTimeoutSeconds;
    constructor(name: string, config: GrpcAppConfig);
    protected provisionApp(): GrpcAppDetails;
}
//# sourceMappingURL=grpc-app-provisioner.d.ts.map