import { given } from "@nivinjoseph/n-defensive";
import { VpcDetails } from "./vpc-details.js";
import * as Pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { NfraConfig } from "../common/nfra-config.js";


export class SecurityGroupHelper
{
    /**
     * @static
     */
    private constructor() { }


    public static resolveCidrBlocks(vpcDetails: VpcDetails, subnetNamePrefixesOrCidrs: ReadonlyArray<string>)
        : Pulumi.Output<Array<string>>
    {
        given(vpcDetails, "vpcDetails").ensureHasValue().ensureIsObject();
        given(subnetNamePrefixesOrCidrs, "subnetNamePrefixesOrCidrs")
            .ensureHasValue().ensureIsArray().ensureIsNotEmpty();

        const cidrs = subnetNamePrefixesOrCidrs
            .where(t => t.split(".").length === 4);

        const namePrefixes = subnetNamePrefixesOrCidrs.where(t => !cidrs.contains(t));

        if (namePrefixes.isEmpty)
            return Pulumi.output(cidrs);

        const cidrBlocks = [
            ...vpcDetails
                .resolveSubnets(namePrefixes)
                .map(u => u.cidrBlock),
            ...cidrs
        ];

        return Pulumi.output(cidrBlocks);
    }
    
    public static createSecurityGroup(name: string, vpcDetails: VpcDetails,
        ingress: ReadonlyArray<SecurityGroupTrafficConfig>, egress: ReadonlyArray<SecurityGroupTrafficConfig>)
        : SecurityGroupDetails
    {
        given(name, "name").ensureHasValue().ensureIsString();
        given(vpcDetails, "vpcDetails").ensureHasValue().ensureIsObject();
        given(ingress, "ingress").ensureHasValue().ensureIsArray().ensureIsNotEmpty();
        given(egress, "egress").ensureHasValue().ensureIsArray().ensureIsNotEmpty();

        name = name.trim();
        if (!name.endsWith("-sg"))
            name += "-sg"; 
        
        const secGroup = new aws.ec2.SecurityGroup(name, {
            vpcId: vpcDetails.vpc.id,
            revokeRulesOnDelete: true,
            ingress: ingress.map(t => ({
                protocol: t.protocol,
                fromPort: t.fromPort,
                toPort: t.toPort,
                cidrBlocks: SecurityGroupHelper.resolveCidrBlocks(
                    vpcDetails, t.subnetNamePrefixesOrCidrs)
            })),
            egress: egress.map(t => ({
                protocol: t.protocol,
                fromPort: t.fromPort,
                toPort: t.toPort,
                cidrBlocks: SecurityGroupHelper.resolveCidrBlocks(
                    vpcDetails, t.subnetNamePrefixesOrCidrs)
            })),
            tags: {
                ...NfraConfig.tags,
                Name: name
            }
        }, {
            // replaceOnChanges: ["*"]
        });
        
        return {
            name: secGroup.name,
            id: secGroup.id,
            arn: secGroup.arn
        };
    }
}

export interface SecurityGroupTrafficConfig
{
    protocol: string;
    fromPort: number;
    toPort: number;
    subnetNamePrefixesOrCidrs: ReadonlyArray<string>;
}

export interface SecurityGroupDetails
{
    name: Pulumi.Output<string>;
    id: Pulumi.Output<string>;
    arn: Pulumi.Output<string>;
}