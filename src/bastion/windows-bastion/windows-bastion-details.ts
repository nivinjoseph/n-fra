import * as Pulumi from "@pulumi/pulumi";


export interface WindowsBastionDetails
{
    publicDns: Pulumi.Output<string>;
    publicIp: Pulumi.Output<string>;
    privateDns: Pulumi.Output<string>;
    privateIp: Pulumi.Output<string>;
    
    privateKeyOpenssh: Pulumi.Output<string>;
    privateKeyPem: Pulumi.Output<string>;
    privateKeyPemPkcs8: Pulumi.Output<string>;
    publicKeyFingerprintMd5: Pulumi.Output<string>;
    publicKeyFingerprintSha256: Pulumi.Output<string>;
    publicKeyOpenssh: Pulumi.Output<string>;
    publicKeyPem: Pulumi.Output<string>;
}