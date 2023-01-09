export interface AppLoadBalancerTarget
{
    host: string;
    slowStart?: number;
    healthCheckPath: string;
}