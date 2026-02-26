import * as aws from "@pulumi/aws";
// import * as awsx from "@pulumi/awsx";
import * as Pulumi from "@pulumi/pulumi";
import { given } from "@nivinjoseph/n-defensive";
import { VpcSubnetDetails } from "./vpc-subnet-details.js";
import { NfraConfig } from "../common/nfra-config.js";


export class VpcDetails
{
    private readonly _vpc: aws.ec2.Vpc;
    private readonly _privateDnsDomain: string;
    private readonly _privateDnsNamespace: aws.servicediscovery.PrivateDnsNamespace;
    private readonly _subnets: ReadonlyArray<VpcSubnetDetails>;
    
    
    public get vpc(): aws.ec2.Vpc { return this._vpc; }
    public get privateDnsDomain(): string { return this._privateDnsDomain; }
    public get privateDnsNamespace(): aws.servicediscovery.PrivateDnsNamespace { return this._privateDnsNamespace; }
    
    
    public constructor(
        vpc: aws.ec2.Vpc,
        privateDnsDomain: string,
        privateDnsNamespace: aws.servicediscovery.PrivateDnsNamespace,
        subnets: ReadonlyArray<VpcSubnetDetails>
    )
    {
        this._vpc = vpc;
        this._privateDnsDomain = privateDnsDomain;
        this._privateDnsNamespace = privateDnsNamespace;
        this._subnets = subnets;
    }
    
    
    public resolveSubnets(filterSubnetPrefixes?: ReadonlyArray<string>): Array<SubnetDetails>
    {
        given(filterSubnetPrefixes, "filterSubnetPrefixes").ensureIsArray().ensureIsNotEmpty();

        // we need ids sometimes and we need cidrs sometimes
        // we need to filter by name prefix and type

        filterSubnetPrefixes ??= this._subnets.map(t => t.prefix);
        
        // const result = this._vpc.subnets
        //     .apply((subnets) =>
        //     {
        //         return subnets
        //             .map(t =>
        //             {
        //                 const id = t.id;
        //                 const cidr = t.cidrBlock as Pulumi.Output<string>;
        //                 const arn = t.arn;
        //                 const availabilityZone = t.availabilityZone;
        //                 const vpcId = t.vpcId;

        //                 return Pulumi.all([id, cidr, arn, availabilityZone, vpcId])
        //                     .apply(([id, cidr, arn, availabilityZone, vpcId]) =>
        //                     {
        //                         const subnetInfo = this._subnets
        //                             .find(t => t.cidrBlock === cidr)!;

        //                         given(subnetInfo, "subnetInfo").ensureHasValue();

        //                         return <SubnetDetails>{
        //                             id,
        //                             prefix: subnetInfo.prefix,
        //                             cidrBlock: cidr,
        //                             arn,
        //                             availabilityZone,
        //                             vpcId
        //                         } satisfies SubnetDetails;
        //                     });
        //             });
        //     });

        // const filteredResult = result.apply(t =>
        // {
        //     return Pulumi.all(t)
        //         .apply(subnets =>
        //         {
        //             const filteredSubnets = subnets.filter(u =>
        //                 filterSubnetPrefixes.contains(u.prefix));

        //             given(filteredSubnets, `filteredSubnets ${filterSubnetPrefixes}`).ensureHasValue().ensureIsArray().ensureIsNotEmpty();

        //             return filteredSubnets;
        //         });
        // });

        // return filteredResult;

        // const intermediate = this._subnets
        //     .filter(t => filterSubnetPrefixes.some(prefix => t.prefix.startsWith(prefix)))
        //     .map(t =>
        //     {
        //         return t.id.apply(id =>
        //         {
        //             return aws.ec2.getSubnetOutput({ id })
        //                 .apply(subnet =>
        //                 {
        //                     // FIXME: most of these values can come from local details
        //                     return <SubnetDetails>{
        //                         id: subnet.id,
        //                         prefix: t.prefix,
        //                         cidrBlock: subnet.cidrBlock,
        //                         arn: subnet.arn,
        //                         availabilityZone: subnet.availabilityZone,
        //                         vpcId: subnet.vpcId
        //                     } satisfies SubnetDetails;
        //                 });
        //         });
        //     });

        // return Pulumi.all(intermediate);

        const intermediate = this._subnets
            .filter(t => filterSubnetPrefixes.some(prefix => t.prefix.startsWith(prefix)))
            .map(t =>
            {
                return {
                    id: t.id,
                    prefix: t.prefix,
                    cidrBlock: t.cidrRange,
                    arn: t.arn,
                    availabilityZone: NfraConfig.awsRegion + t.az,
                    vpcId: this._vpc.id
                } satisfies SubnetDetails;
            });

        return intermediate;
    }
}

// export interface SubnetInfo
// {
//     type: VpcSubnetType;
//     cidrBlock: string;
//     prefix: string;
// }

export interface SubnetDetails
{
    id: Pulumi.Output<string>;
    prefix: string;
    cidrBlock: string;
    arn: Pulumi.Output<string>;
    availabilityZone: string;
    vpcId: Pulumi.Output<string>;
}