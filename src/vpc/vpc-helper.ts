// import * as Pulumi from "@pulumi/pulumi";
// import * as aws from "@pulumi/aws";
// import { given } from "@nivinjoseph/n-defensive";
// import { SubnetDetails } from "./vpc-details.js";


// export class VpcHelper
// {
//     /**
//      * @static
//      */
//     private constructor() { }
    
    
//     public static fetchSubnets(vpcId: Pulumi.Input<string> | string, filterSubnetPrefixes?: ReadonlyArray<string>): Pulumi.Output<Array<SubnetDetails>>
//     {
//         given(vpcId, "vpcId").ensureHasValue();
//         given(filterSubnetPrefixes, "filterSubnetPrefixes").ensureIsArray().ensureIsNotEmpty();
        
//         const outputVpcId = Pulumi.output(vpcId);

//         const result = outputVpcId
//             .apply(t =>
//             {
//                 return aws.ec2
//                     .getSubnetsOutput({
//                         filters: [{
//                             name: "vpc-id", values: [t]
//                         }]
//                     });
//             })
//             .apply(subnets =>
//             {
//                 const intermediate = subnets.ids
//                     .map(t => aws.ec2.getSubnetOutput({ id: t, vpcId: outputVpcId }))
//                     .map(t =>
//                     {
//                         return t.apply(u =>
//                         {
//                             const details = <SubnetDetails>{
//                                 id: u.id,
//                                 // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
//                                 prefix: u.tags["Prefix"]?.trim(),
//                                 cidrBlock: u.cidrBlock,
//                                 arn: u.arn,
//                                 availabilityZone: u.availabilityZone,
//                                 vpcId: u.vpcId
//                             } satisfies SubnetDetails;
                            
//                             // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
//                             if (details.prefix == null || details.prefix.isEmptyOrWhiteSpace())
//                                 // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
//                                 details.prefix = u.tags["Name"]?.trim();
                            
//                             given(details.prefix, "subnetPrefix").ensureHasValue().ensureIsString();
                            
//                             return details;
//                         });
//                     });

//                 return Pulumi.all(intermediate);
//             });

//         return result.apply(t =>
//         {
//             const filteredSubnets = filterSubnetPrefixes != null && filterSubnetPrefixes.isNotEmpty
//                 ? t.filter(u =>
//                     filterSubnetPrefixes.some(prefix =>
//                         u.prefix.startsWith(prefix)))
//                 : t;
            
//             given(filteredSubnets, "filteredSubnets").ensureHasValue().ensureIsArray().ensureIsNotEmpty();

//             return filteredSubnets;
//         });
        
//         // return filterSubnetPrefixes != null && filterSubnetPrefixes.isNotEmpty
//         //     ? result.apply(t =>
//         //         t.filter(u =>
//         //             filterSubnetPrefixes.some(prefix =>
//         //                 u.prefix.startsWith(prefix))))
//         //     : result;
//     }
    
//     public static resolveRouteTableId(subnetDetails: SubnetDetails): Pulumi.Output<string>
//     {
//         given(subnetDetails, "subnetDetails").ensureHasValue();
        
//         const rt = aws.ec2.getRouteTableOutput({
//             subnetId: subnetDetails.id,
//             vpcId: subnetDetails.vpcId
//         });

//         return rt.routeTableId;
//     }
    
//     // public static resolveSubnets(vpcDetails: VpcDetails, subnetType: VpcSubnetType, subnetPrefix: string): void
//     // {
//     //     let subnetIds: Pulumi.Output<Array<string>>;
//     //     switch (subnetType)
//     //     {
//     //         case VpcSubnetType.public:
//     //             subnetIds = vpcDetails.vpc.publicSubnetIds;
//     //             break;
//     //         case VpcSubnetType.private:
//     //             subnetIds = vpcDetails.vpc.privateSubnetIds;
//     //             break;
//     //         case VpcSubnetType.isolated:
//     //             subnetIds = vpcDetails.vpc.isolatedSubnetIds;
//     //             break;
//     //         default:
//     //             ensureExhaustiveCheck(subnetType);
//     //     }
        
        
        
//     //     const result = Pulumi.all([subnetIds, vpcDetails.vpc.subnets])
//     //         .apply(([ids, subnets]) =>
//     //         {
//     //             return subnets
//     //                 .filter(t => t.id.apply(u => ids.contains(u)))
//     //                 .filter(t => t.tags.apply(u => u!["Name"].startsWith(subnetPrefix)));
//     //         });
        
//     //     // vpcDetails.vpc.subnets.apply(t => t.filter(u => u.))
//     // }
    
//     // public static fetchVpc(vpcId: string): void
//     // {
//     //     aws.ec2.getVpcOutput({
//     //         id: vpcId
//     //     }).apply(t =>
//     //     {
//     //         const result: VpcDetails = {
//     //             vpc: t.
//     //         }
//     //     });
//     // }
// }


