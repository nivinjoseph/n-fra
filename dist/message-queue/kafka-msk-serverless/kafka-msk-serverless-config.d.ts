import { VpcDetails } from "../../vpc/vpc-details.js";
export interface KafkaMskServerlessConfig {
    vpcDetails: VpcDetails;
    subnetNamePrefix: string;
    ingressSubnetNamePrefixes: ReadonlyArray<string>;
}
//# sourceMappingURL=kafka-msk-serverless-config.d.ts.map