import * as Pulumi from "@pulumi/pulumi";
import { EfsAccessPointDetails } from "./efs-access-point-details.js";
export declare class EfsDetails {
    private readonly _efsName;
    private readonly _fileSystemId;
    private readonly _fileSystemArn;
    get fileSystemId(): Pulumi.Output<string>;
    get fileSystemArn(): Pulumi.Output<string>;
    constructor(efsName: string, fileSystemId: Pulumi.Output<string>, fileSystemArn: Pulumi.Output<string>);
    provisionAccessPoint(path: string, posixUser?: {
        uid: number;
        gid: number;
        permissions: number;
    }): EfsAccessPointDetails;
}
//# sourceMappingURL=efs-details.d.ts.map