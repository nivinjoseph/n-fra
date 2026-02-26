import { given } from "@nivinjoseph/n-defensive";
import * as Pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { NfraConfig } from "../../common/nfra-config.js";


export class NlbDetails
{
    private readonly _arn: Pulumi.Output<string>;
    private readonly _host: Pulumi.Output<string>;
    private readonly _port: number;
    
    
    public get arn(): Pulumi.Output<string> { return this._arn; }
    public get host(): Pulumi.Output<string> { return this._host; }
    public get port(): number { return this._port; }
    
    
    public constructor(arn: Pulumi.Output<string>, host: Pulumi.Output<string>, port: number)
    {
        given(arn, "arn").ensureHasValue().ensureIsObject();
        this._arn = arn;
        
        given(host, "host").ensureHasValue().ensureIsObject();
        this._host = host;
        
        given(port, "port").ensureHasValue().ensureIsNumber();
        this._port = port;
    }
    
    
    public createVpcEndpointService(name: string, allowedAwsAccounts: ReadonlyArray<string>): { serviceName: Pulumi.Output<string>; }
    {
        given(name, "name").ensureHasValue().ensureIsString();
        given(allowedAwsAccounts, "allowedAwsAccounts").ensureHasValue().ensureIsNotEmpty();
        
        // vpc endpoint service principal
        // arn:aws:iam::667762432193:root

        const vpceName = `${name}-ves`;
        const vpce = new aws.ec2.VpcEndpointService(vpceName, {
            acceptanceRequired: false,
            networkLoadBalancerArns: [this._arn],
            supportedIpAddressTypes: ["ipv4"],
            allowedPrincipals: allowedAwsAccounts.map(accountId => `arn:aws:iam::${accountId}:root`),
            tags: {
                ...NfraConfig.tags,
                Name: vpceName
            }
        });
        
        return {
            serviceName: vpce.serviceName
        };
    }
}