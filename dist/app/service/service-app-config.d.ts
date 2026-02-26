import { Schema } from "@nivinjoseph/n-util";
import { AppConfig } from "../app-config.js";
import * as Pulumi from "@pulumi/pulumi";
export interface ServiceAppConfig extends Schema<AppConfig, "vpcDetails" | "subnetNamePrefix" | "image" | "version" | "command" | "entryPoint" | "useDockerfileCommandOrEntryPoint" | "envVars" | "secrets" | "policies" | "isOn" | "datadogConfig" | "enableXray" | "clusterConfig" | "disableReadonlyRootFilesystem"> {
    ingressSubnetNamePrefixes: ReadonlyArray<string>;
    port: number;
    taskVolumes?: Array<{
        name: string;
        hostPath?: string;
    }>;
    containerMountPoints?: Array<{
        sourceVolume: string;
        containerPath: string;
    }>;
    computeProfile?: ServiceAppComputeProfile;
    volumeSize?: number;
    userDataFunc?(context: UserDataContext): Pulumi.Output<string>;
}
export declare enum ServiceAppComputeProfile {
    /**
     * @description cpu 2, memory 4
     */
    large = 4,
    /**
     * @description cpu 4, memory 8
     */
    xlarge = 5,
    /**
     * @description cpu 8, memory 16
     */
    xxlarge = 6,
    /**
     * @description cpu 16, memory 32
     */
    xxxlarge = 7
}
export interface UserDataContext {
    clusterName: Pulumi.Output<string>;
    ebsVolumeId: Pulumi.Output<string>;
}
//# sourceMappingURL=service-app-config.d.ts.map