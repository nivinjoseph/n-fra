import { Mesh } from "@pulumi/aws/appmesh";
import { PrivateDnsNamespace } from "@pulumi/aws/servicediscovery";
import { Vpc } from "@pulumi/awsx/ec2";


export interface VpcDetails
{
    vpc: Vpc;
    serviceMesh: Mesh;
    privateDnsNamespace: PrivateDnsNamespace;
}