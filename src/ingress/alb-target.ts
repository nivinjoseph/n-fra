export interface AlbTarget
{
    host: string;
    slowStart?: number;
    healthCheckPath: string;
}