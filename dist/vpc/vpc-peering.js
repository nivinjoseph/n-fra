// import { VpcDetails } from "./vpc-details.js";
// import * as Pulumi from "@pulumi/pulumi";
// import * as aws from "@pulumi/aws";
// import { NfraConfig } from "../common/nfra-config.js";
// import { VpcHelper } from "./vpc-helper.js";
// import { given } from "@nivinjoseph/n-defensive";
export {};
// export class VpcPeering
// {
//     /**
//      * @static
//      */
//     private constructor() { }
//     public static create(name: string, sourceVpc: VpcDetails, targetVpcId: Pulumi.Input<string> | string,
//         routings: ReadonlyArray<{ sourceSubnetPrefix: string; targetSubnetPrefix: string; }>): void
//     {
//         given(name, "name").ensureHasValue().ensureIsString();
//         given(sourceVpc, "sourceVpc").ensureHasValue().ensureIsType(VpcDetails);
//         given(targetVpcId, "targetVpcId").ensureHasValue();
//         given(routings, "routings").ensureHasValue().ensureIsArray().ensureIsNotEmpty();
//         const vpcPeering = new aws.ec2.VpcPeeringConnection(name, {
//             vpcId: sourceVpc.vpc.id,
//             peerVpcId: targetVpcId,
//             accepter: {
//                 allowRemoteVpcDnsResolution: true
//             },
//             requester: {
//                 allowRemoteVpcDnsResolution: true
//             },
//             autoAccept: true,
//             tags: {
//                 ...NfraConfig.tags,
//                 Name: name
//             }
//         });
//         for (const routing of routings)
//         {
//             const sourceSubnetPrefix = routing.sourceSubnetPrefix;
//             const targetSubnetPrefix = routing.targetSubnetPrefix;
//             const sourceSubnets = Pulumi.output(sourceVpc.resolveSubnets([sourceSubnetPrefix]));
//             const targetSubnets = VpcHelper.fetchSubnets(targetVpcId, [targetSubnetPrefix]);
//             sourceSubnets.apply(t =>
//             {
//                 t.forEach((sourceSubnet, sourceSubnetIndex) =>
//                 {
//                     if (!sourceSubnet.prefix.startsWith(sourceSubnetPrefix))
//                         return;
//                     targetSubnets.apply(u =>
//                     {
//                         u.forEach((targetSubnet, targetSubnetIndex) =>
//                         {
//                             if (!targetSubnet.prefix.startsWith(targetSubnetPrefix))
//                                 return;
//                             const sourceToTargetRouteName = `${sourceSubnet.prefix}-${sourceSubnetIndex}-${targetSubnet.prefix}-${targetSubnetIndex}-rte`;
//                             new aws.ec2.Route(sourceToTargetRouteName, {
//                                 routeTableId: VpcHelper.resolveRouteTableId(sourceSubnet),
//                                 destinationCidrBlock: targetSubnet.cidrBlock,
//                                 vpcPeeringConnectionId: vpcPeering.id
//                             });
//                             const targetToSourceRouteName = `${targetSubnet.prefix}-${targetSubnetIndex}-${sourceSubnet.prefix}-${sourceSubnetIndex}-rte`;
//                             new aws.ec2.Route(targetToSourceRouteName, {
//                                 routeTableId: VpcHelper.resolveRouteTableId(targetSubnet),
//                                 destinationCidrBlock: sourceSubnet.cidrBlock,
//                                 vpcPeeringConnectionId: vpcPeering.id
//                             });
//                         });
//                     });
//                 });
//             });
//         }
//     }
// }
//# sourceMappingURL=vpc-peering.js.map