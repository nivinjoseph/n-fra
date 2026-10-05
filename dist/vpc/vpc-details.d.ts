import * as aws from "@pulumi/aws";
import * as Pulumi from "@pulumi/pulumi";
import { VpcSubnetDetails } from "./vpc-subnet-details.js";
export declare class VpcDetails {
    private readonly _vpc;
    private readonly _privateDnsDomain;
    private readonly _privateDnsNamespace;
    private readonly _subnets;
    get vpc(): aws.ec2.Vpc;
    get privateDnsDomain(): string;
    get privateDnsNamespace(): aws.servicediscovery.PrivateDnsNamespace;
    constructor(vpc: aws.ec2.Vpc, privateDnsDomain: string, privateDnsNamespace: aws.servicediscovery.PrivateDnsNamespace, subnets: ReadonlyArray<VpcSubnetDetails>);
    /**
     * Resolves the subnets whose `prefix` starts with any of the given prefixes, so `"private"` matches both
     * `"private-app"` and `"private-db"`. Every config field named `subnetNamePrefix`, `ingressSubnetNamePrefixes`,
     * `egressSubnetNamePrefixes` or `dbSubnetNamePrefix` is resolved through this method.
     * @param filterSubnetPrefixes prefixes to match against `VpcSubnetConfig.prefix`; omit to resolve every subnet in the VPC
     * @throws ArgumentException when any given prefix matches no subnet; the message lists the prefixes that exist
     */
    resolveSubnets(filterSubnetPrefixes?: ReadonlyArray<string>): Array<SubnetDetails>;
}
export interface SubnetDetails {
    id: Pulumi.Output<string>;
    prefix: string;
    cidrBlock: string;
    arn: Pulumi.Output<string>;
    availabilityZone: string;
    vpcId: Pulumi.Output<string>;
}
//# sourceMappingURL=vpc-details.d.ts.map