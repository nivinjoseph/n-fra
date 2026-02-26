import type { AppConfig } from "../app-config.js";
import * as Pulumi from "@pulumi/pulumi";
export interface HttpAppConfig extends AppConfig {
    ingressSubnetNamePrefixes: ReadonlyArray<string>;
    albTargetGroupArn?: Pulumi.Input<string>;
    defaultAppPortOverride?: number;
}
//# sourceMappingURL=http-app-config.d.ts.map