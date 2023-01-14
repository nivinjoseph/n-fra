// import { Mesh } from "@pulumi/aws/appmesh";
import * as aws from "@pulumi/aws";
// import { PrivateDnsNamespace } from "@pulumi/aws/servicediscovery";
// import { Vpc } from "@pulumi/awsx/ec2";
import * as awsx from "@pulumi/awsx";


export interface VpcDetails
{
    vpc: awsx.ec2.Vpc;
    serviceMesh: aws.appmesh.Mesh;
    privateDnsNamespace: aws.servicediscovery.PrivateDnsNamespace;
    privateDnsDomain: string;
}