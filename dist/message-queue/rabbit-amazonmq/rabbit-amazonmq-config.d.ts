import { VpcDetails } from "../../vpc/vpc-details.js";
export interface RabbitAmazonmqConfig {
    vpcDetails: VpcDetails;
    subnetNamePrefix: string;
    ingressSubnetNamePrefixes: ReadonlyArray<string>;
    instanceType: RabbitAmazonmqInstanceType;
    username?: string;
    password?: string;
    isHA?: boolean;
}
export declare enum RabbitAmazonmqInstanceType {
    small = "mq.m5.large",
    medium = "mq.m5.xlarge",
    large = "mq.m5.2xlarge",
    xlarge = "mq.m5.4xlarge"
}
//# sourceMappingURL=rabbit-amazonmq-config.d.ts.map