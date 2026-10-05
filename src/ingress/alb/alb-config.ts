import type { SubnetNamePrefix } from "../../vpc/vpc-subnet-config.js";
import type { VpcDetails } from "../../vpc/vpc-details.js";
import type { AlbTarget } from "./alb-target.js";


export interface AlbConfig
{
    /** The VPC to deploy into, as returned by `VpcProvisioner.provision()`. */
    vpcDetails: VpcDetails;
    /** Prefix of the VPC subnets the load balancer is placed in (public, unless `isPrivate`) (matches `VpcSubnetConfig.prefix`; see `SubnetNamePrefix`). */
    subnetNamePrefix: SubnetNamePrefix;
    /** Prefixes of the subnets the ALB may send traffic to: the `subnetNamePrefix` of every HTTP app behind it. */
    egressSubnetNamePrefixes: ReadonlyArray<SubnetNamePrefix>;
    /** ACM certificate ARN. When set, an HTTPS listener is created and HTTP redirects to it; otherwise only HTTP is served. */
    certificateArn?: string;
    /** Default: `false`. Attaches a WAF web ACL with AWS managed rule groups (later edits to its rules are ignored by Pulumi). */
    enableWaf?: boolean;
    /** Default: `false`. Publishes WAF CloudWatch metrics; only meaningful with `enableWaf`. */
    enableWafCloudWatchMetrics?: boolean;
    /** Default: `false`. Restricts ALB ingress to the CloudFront origin-facing prefix list. */
    enableCloudfront?: boolean;
    /** One target per host header. A `"default"` host must be the only target. Each gets its own target group in `AlbDetails.hostTargets`. */
    targets: ReadonlyArray<AlbTarget>;
    /** Default: `false`. Creates only the load balancer and its security group, with no listeners or target groups; `hostTargets` is empty. */
    justAlb?: boolean;
    /** Extra AWS tags merged over `NfraConfig.tags`. */
    tags?: object;
    /** Default: `false`. Creates an internal ALB reachable only inside the VPC. */
    isPrivate?: boolean;
    /** Prefixes of the subnets allowed to reach the ALB. Default: open to `0.0.0.0/0`. */
    ingressSubnetNamePrefixes?: ReadonlyArray<SubnetNamePrefix>;
}