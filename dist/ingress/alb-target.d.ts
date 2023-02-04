export interface AlbTarget {
    host: string | "default";
    slowStart?: number;
    healthCheckPath: string;
}
