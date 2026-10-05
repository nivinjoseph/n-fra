import type { AppConfig } from "../app-config.js";
import type { SubnetNamePrefix } from "../../vpc/vpc-subnet-config.js";


export type GrpcAppConfig = AppConfig & {
    /** Prefixes of the subnets whose CIDR ranges may reach the gRPC port 50051; they become the security group's ingress rules. */
    ingressSubnetNamePrefixes: ReadonlyArray<SubnetNamePrefix>;
};
