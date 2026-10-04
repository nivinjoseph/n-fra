export interface AlbTarget
{
    host: string | "default";
    healthCheckPath: string;
    healthCheckTimeout?: number;
    /** consecutive failed ALB health checks before the target is taken out of service (2-10, default 5) */
    healthCheckUnhealthyThreshold?: number;
    /** consecutive successful ALB health checks before an unhealthy target is put back in service (2-10, default 2) */
    healthCheckHealthyThreshold?: number;
    slowStart?: number;
    defaultAppPortOverride?: number;
    pathPattern?: string;
}