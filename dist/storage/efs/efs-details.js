import { given } from "@nivinjoseph/n-defensive";
import { EfsAccessPointDetails } from "./efs-access-point-details.js";
import * as aws from "@pulumi/aws";
import { NfraConfig } from "../../common/nfra-config.js";
export class EfsDetails {
    _efsName;
    _fileSystemId;
    _fileSystemArn;
    get fileSystemId() { return this._fileSystemId; }
    get fileSystemArn() { return this._fileSystemArn; }
    constructor(efsName, fileSystemId, fileSystemArn) {
        given(efsName, "efsName").ensureHasValue().ensureIsString();
        this._efsName = efsName;
        given(fileSystemId, "fileSystemId").ensureHasValue().ensureIsObject();
        this._fileSystemId = fileSystemId;
        given(fileSystemArn, "fileSystemArn").ensureHasValue().ensureIsObject();
        this._fileSystemArn = fileSystemArn;
    }
    provisionAccessPoint(path, posixUser) {
        given(path, "path").ensureHasValue().ensureIsString();
        path = path.trim();
        const splitted = path.split("/").where(t => t.isNotEmptyOrWhiteSpace());
        given(splitted, "path")
            .ensure(t => t.length <= 4, "must not have more then 4 subdirectories");
        given(posixUser, "posixUser").ensureIsObject()
            .ensureHasStructure({
            uid: "number",
            gid: "number",
            permissions: "number"
        });
        path = "/" + splitted.join("/");
        const uid = posixUser?.uid ?? 0; // 0 is superuser?
        const gid = posixUser?.gid ?? 0;
        const permissions = posixUser?.permissions ?? 755;
        const accessPointName = `${this._efsName}-efs-ap`;
        const accessPoint = new aws.efs.AccessPoint(accessPointName, {
            fileSystemId: this._fileSystemId,
            posixUser: { uid, gid },
            rootDirectory: {
                path,
                creationInfo: {
                    ownerGid: uid, // maps to the same as above
                    ownerUid: gid, // maps to the same as above
                    permissions: permissions.toString() // "755"
                }
            },
            tags: {
                ...NfraConfig.tags,
                Name: accessPointName
            }
        });
        return new EfsAccessPointDetails(accessPoint.id, accessPoint.arn, this);
    }
}
//# sourceMappingURL=efs-details.js.map