import * as Pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { EfsDetails } from "./efs-details.js";
import { PolicyDocument } from "../../security/policy/policy-document.js";
export declare class EfsAccessPointDetails {
    private readonly _accessPointId;
    private readonly _accessPointArn;
    private readonly _efsDetails;
    constructor(accessPointId: Pulumi.Output<string>, accessPointArn: Pulumi.Output<string>, efsDetails: EfsDetails);
    createEfsVolumeConfigurationForEcsTaskDefinition(): EcsTaskDefinitionVolumeEfsVolumeConfiguration;
    createReadPolicy(): PolicyDocument;
    createReadWritePolicy(): PolicyDocument;
    createRootAccessPolicy(): PolicyDocument;
}
export type EcsTaskDefinitionVolumeEfsVolumeConfiguration = aws.types.input.ecs.TaskDefinitionVolumeEfsVolumeConfiguration;
//# sourceMappingURL=efs-access-point-details.d.ts.map