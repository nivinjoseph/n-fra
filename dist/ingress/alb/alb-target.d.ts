export interface AlbTarget {
    host: string | "default";
    healthCheckPath: string;
    healthCheckTimeout?: number;
    slowStart?: number;
    defaultAppPortOverride?: number;
    pathPattern?: string;
}
//# sourceMappingURL=alb-target.d.ts.map