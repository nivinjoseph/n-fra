import * as Pulumi from "@pulumi/pulumi";


export interface KafkaMskProvisionedDetails
{
    clusterUuid: Pulumi.Output<string>;
    clusterName: Pulumi.Output<string>;
    clusterArn: Pulumi.Output<string>;
    bootstrapBrokers: Pulumi.Output<string>;
    bootstrapBrokersPublic?: Pulumi.Output<string>;
}