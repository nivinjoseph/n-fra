import { VpcSubnetConfig } from "./vpc-subnet-config.js";
import * as Pulumi from "@pulumi/pulumi";
export interface VpcSubnetDetails extends VpcSubnetConfig {
    id: Pulumi.Output<string>;
    arn: Pulumi.Output<string>;
    routeTableId: Pulumi.Output<string>;
}
//# sourceMappingURL=vpc-subnet-details.d.ts.map