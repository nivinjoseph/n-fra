import * as Pulumi from "@pulumi/pulumi";
import { PolicyDocument } from "../../security/policy/policy-document.js";
import { AccessUserDetails } from "../../security/access-user/access-user-details.js";
export declare class S3bucketDetails {
    private readonly _provisionerName;
    private readonly _bucketId;
    private readonly _bucketArn;
    private _glueRole;
    private _glueDb;
    get bucketId(): Pulumi.Output<string>;
    get bucketArn(): Pulumi.Output<string>;
    get glueDbName(): Pulumi.Output<string>;
    constructor(provisionerName: string, bucketId: Pulumi.Output<string>, bucketArn: Pulumi.Output<string>);
    createReadPolicy(): PolicyDocument;
    createWritePolicy(): PolicyDocument;
    createReadWritePolicy(): PolicyDocument;
    addAccessUser(accessUser: AccessUserDetails, accessControls: ["GET"?, "PUT"?]): void;
    provisionGlueCrawlerForAthena(subFolder: string): this;
    private _provisionGlueRole;
    private _provisionGlueDb;
}
//# sourceMappingURL=s3bucket-details.d.ts.map