import { given } from "@nivinjoseph/n-defensive";
import { EfsDetails } from "./efs-details.js";
export class EfsAccessPointDetails {
    constructor(accessPointId, accessPointArn, efsDetails) {
        given(accessPointId, "accessPointId").ensureHasValue().ensureIsObject();
        this._accessPointId = accessPointId;
        given(accessPointArn, "accessPointArn").ensureHasValue().ensureIsObject();
        this._accessPointArn = accessPointArn;
        given(efsDetails, "efsDetails").ensureHasValue().ensureIsType(EfsDetails);
        this._efsDetails = efsDetails;
    }
    createEfsVolumeConfigurationForEcsTaskDefinition() {
        const result = {
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
    createReadPolicy() {
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
    createReadWritePolicy() {
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
    createRootAccessPolicy() {
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
//# sourceMappingURL=efs-access-point-details.js.map