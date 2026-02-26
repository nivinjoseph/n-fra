import * as Pulumi from "@pulumi/pulumi";
export interface KafkaMskServerlessDetails {
    clusterName: Pulumi.Output<string>;
    clusterArn: Pulumi.Output<string>;
    bootstrapBrokers: Pulumi.Output<string>;
}
//# sourceMappingURL=kafka-msk-serverless-details.d.ts.map