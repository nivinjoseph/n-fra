import { given } from "@nivinjoseph/n-defensive";
import * as Pulumi from "@pulumi/pulumi";
import { EfsAccessPointDetails } from "./efs-access-point-details.js";
import * as aws from "@pulumi/aws";
import { NfraConfig } from "../../common/nfra-config.js";


export class EfsDetails
{
    private readonly _efsName: string;
    private readonly _fileSystemId: Pulumi.Output<string>;
    private readonly _fileSystemArn: Pulumi.Output<string>;
    
    
    public get fileSystemId(): Pulumi.Output<string> { return this._fileSystemId; }
    public get fileSystemArn(): Pulumi.Output<string> { return this._fileSystemArn; }
    
    
    public constructor(efsName: string, fileSystemId: Pulumi.Output<string>, fileSystemArn: Pulumi.Output<string>)
    {
        given(efsName, "efsName").ensureHasValue().ensureIsString();
        this._efsName = efsName;
        
        given(fileSystemId, "fileSystemId").ensureHasValue().ensureIsObject();
        this._fileSystemId = fileSystemId;
        
        given(fileSystemArn, "fileSystemArn").ensureHasValue().ensureIsObject();
        this._fileSystemArn = fileSystemArn;
    }
    
    
    public provisionAccessPoint(path: string, posixUser?: { uid: number; gid: number; permissions: number; }): EfsAccessPointDetails
    {
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
                    permissions: permissions.toString()  // "755"
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