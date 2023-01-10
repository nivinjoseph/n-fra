import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
export interface VpcDetails {
    vpc: awsx.ec2.Vpc;
    serviceMesh: aws.appmesh.Mesh;
    privateDnsNamespace: aws.servicediscovery.PrivateDnsNamespace;
}
