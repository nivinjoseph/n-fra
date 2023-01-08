import { Mesh } from "@pulumi/aws/appmesh";
import { PrivateDnsNamespace } from "@pulumi/aws/servicediscovery";
import { Vpc } from "@pulumi/awsx/ec2";
export interface VpcInfo {
    get vpc(): Vpc;
    get serviceMesh(): Mesh;
    get privateDnsNamespace(): PrivateDnsNamespace;
}
