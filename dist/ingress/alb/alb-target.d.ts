/** A host header to route, or `"default"` for the listener's default action (which must then be the only target). */
export type AlbHost = "default" | (string & Record<never, never>);
export interface AlbTarget {
    host: AlbHost;
    /** Path the ALB target group health check requests, e.g. `"/healthCheck"`. Independent of the container's own ECS probe, which is always `/healthCheck`. */
    healthCheckPath: string;
    /** Seconds the ALB waits for a health check response; clamped to 5-60. */
    healthCheckTimeout?: number;
    /** consecutive failed ALB health checks before the target is taken out of service (2-10, default 5) */
    healthCheckUnhealthyThreshold?: number;
    /** consecutive successful ALB health checks before an unhealthy target is put back in service (2-10, default 2) */
    healthCheckHealthyThreshold?: number;
    /** Seconds a new target ramps up to its full share of requests, 30-900. Default: disabled. */
    slowStart?: number;
    /** Port the target group forwards to. Default: 80. Must equal the HTTP app's `defaultAppPortOverride`. */
    defaultAppPortOverride?: number;
    /** Path pattern for the listener rule, must start with `/`. Only supported on the `"default"` host. */
    pathPattern?: string;
}
//# sourceMappingURL=alb-target.d.ts.map