import { given } from "@nivinjoseph/n-defensive";
import * as Pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { EfsDetails } from "./efs-details.js";
import { PolicyDocument } from "../../security/policy/policy-document.js";


export class EfsAccessPointDetails
{
    private readonly _accessPointId: Pulumi.Output<string>;
    private readonly _accessPointArn: Pulumi.Output<string>;
    private readonly _efsDetails: EfsDetails;
    
    
    
    public constructor(accessPointId: Pulumi.Output<string>, accessPointArn: Pulumi.Output<string>, efsDetails: EfsDetails)
    {
        given(accessPointId, "accessPointId").ensureHasValue().ensureIsObject();
        this._accessPointId = accessPointId;
        
        given(accessPointArn, "accessPointArn").ensureHasValue().ensureIsObject();
        this._accessPointArn = accessPointArn;
        
        given(efsDetails, "efsDetails").ensureHasValue().ensureIsType(EfsDetails);
        this._efsDetails = efsDetails;
    }
    
    
    public createEfsVolumeConfigurationForEcsTaskDefinition(): EcsTaskDefinitionVolumeEfsVolumeConfiguration
    {
        const result: aws.types.input.ecs.TaskDefinitionVolumeEfsVolumeConfiguration = {
            fileSystemId: this._efsDetails.fileSystemId,
            // rootDirectory: "/", // this is determined by access point
            transitEncryption: "ENABLED",
            authorizationConfig: {
                accessPointId: this._accessPointId,
                iam: "ENABLED"
            }
        };
        
        return result;
    }
    
    public createReadPolicy(): PolicyDocument
    {
        return {
            Version: "2012-10-17",
            Statement: [{
                Effect: "Allow",
                Action: [
                    "elasticfilesystem:ClientMount"
                ],
                Resource: this._efsDetails.fileSystemArn,
                Condition: {
                    "StringEquals": {
                        "elasticfilesystem:AccessPointArn": this._accessPointArn
                    }
                }
            }]
        };
    }
    
    public createReadWritePolicy(): PolicyDocument
    {
        return {
            Version: "2012-10-17",
            Statement: [{
                Effect: "Allow",
                Action: [
                    "elasticfilesystem:ClientMount",
                    "elasticfilesystem:ClientWrite"
                ],
                Resource: this._efsDetails.fileSystemArn,
                Condition: {
                    "StringEquals": {
                        "elasticfilesystem:AccessPointArn": this._accessPointArn
                    }
                }
            }]
        };
    }
    
    public createRootAccessPolicy(): PolicyDocument
    {
        return {
            Version: "2012-10-17",
            Statement: [{
                Effect: "Allow",
                Action: [
                    "elasticfilesystem:ClientMount",
                    "elasticfilesystem:ClientWrite",
                    "elasticfilesystem:ClientRootAccess"
                ],
                Resource: this._efsDetails.fileSystemArn,
                Condition: {
                    "StringEquals": {
                        "elasticfilesystem:AccessPointArn": this._accessPointArn
                    }
                }
            }]
        };
    }
}

export type EcsTaskDefinitionVolumeEfsVolumeConfiguration = aws.types.input.ecs.TaskDefinitionVolumeEfsVolumeConfiguration;