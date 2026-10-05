import type { AppConfig } from "../app-config.js";
import type { SubnetNamePrefix } from "../../vpc/vpc-subnet-config.js";
import * as Pulumi from "@pulumi/pulumi";
/** The fields an HTTP app adds on top of `AppConfig`. */
export interface HttpAppConfigExtension {
    /** Prefixes of the subnets whose CIDR ranges may reach the app port, normally the ALB's `subnetNamePrefix`; they become the security group's ingress rules. */
    ingressSubnetNamePrefixes: ReadonlyArray<SubnetNamePrefix>;
    /** Target group to register the service with: `AlbDetails.hostTargets[<host>].albTargetGroupArn` from `AlbProvisioner`. */
    albTargetGroupArn?: Pulumi.Input<string>;
    /** Port the container listens on. Default: 80. Must equal the matching `AlbTarget.defaultAppPortOverride`. */
    defaultAppPortOverride?: number;
}
export type HttpAppConfig = AppConfig & HttpAppConfigExtension;
//# sourceMappingURL=http-app-config.d.ts.map