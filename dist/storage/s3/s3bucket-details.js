import { given } from "@nivinjoseph/n-defensive";
import * as Pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { NfraConfig } from "../../common/nfra-config.js";
export class S3bucketDetails {
    get bucketId() { return this._bucketId; }
    get bucketArn() { return this._bucketArn; }
    get glueDbName() {
        given(this, "this")
            .ensure(t => t._glueDb !== null, "must have glueDb provisioned");
        return this._glueDb.name;
    }
    constructor(provisionerName, bucketId, bucketArn) {
        this._glueRole = null;
        this._glueDb = null;
        given(provisionerName, "provisionerName").ensureHasValue().ensureIsString();
        this._provisionerName = provisionerName;
        given(bucketId, "bucketId").ensureHasValue().ensureIsObject();
        this._bucketId = bucketId;
        given(bucketArn, "bucketArn").ensureHasValue().ensureIsObject();
        this._bucketArn = bucketArn;
    }
    createReadPolicy() {
        return {
            Version: "2012-10-17",
            Statement: [{
                    Effect: "Allow",
                    Action: [
                        "s3:GetObject"
                    ],
                    Resource: Pulumi.interpolate `${this._bucketArn}/*`
                }]
        };
    }
    createWritePolicy() {
        return {
            Version: "2012-10-17",
            Statement: [{
                    Effect: "Allow",
                    Action: [
                        "s3:PutObject",
                        "s3:PutObjectAcl"
                    ],
                    Resource: Pulumi.interpolate `${this._bucketArn}/*`
                }]
        };
    }
    createReadWritePolicy() {
        return {
            Version: "2012-10-17",
            Statement: [{
                    Effect: "Allow",
                    Action: [
                        "s3:GetObject",
                        "s3:PutObject",
                        "s3:PutObjectAcl"
                    ],
                    Resource: Pulumi.interpolate `${this._bucketArn}/*`
                }]
        };
    }
    addAccessUser(accessUser, accessControls) {
        given(accessUser, "accessUser").ensureHasValue().ensureIsObject();
        given(accessControls, "accessControls").ensureHasValue()
            .ensureIsArray().ensureIsNotEmpty()
            .ensure(t => t.every(u => u == "GET" || u == "PUT"));
        const allowedActions = new Array();
        if (accessControls.contains("GET"))
            allowedActions.push("s3:GetObject");
        if (accessControls.contains("PUT"))
            allowedActions.push("s3:PutObject", "s3:PutObjectAcl");
        const policy = {
            Version: "2012-10-17",
            Id: `${this._provisionerName}-au-policy`,
            Statement: [{
                    Effect: "Allow",
                    Principal: { AWS: accessUser.userArn },
                    Action: allowedActions,
                    Resource: Pulumi.interpolate `${this._bucketArn}/*`
                }]
        };
        new aws.s3.BucketPolicy(`${this._provisionerName}-bucket-au-pol`, {
            bucket: this._bucketId,
            policy
        });
    }
    provisionGlueCrawlerForAthena(subFolder) {
        given(subFolder, "subFolder").ensureHasValue().ensureIsString();
        const glueRole = this._provisionGlueRole();
        const db = this._provisionGlueDb();
        // const cron = "cron(0/15 * * * ? *)"; // every 15 mins
        // const cron = "cron(1 0/23 * * *)";
        // const cron = "cron(30 6 * * ? *)"; // At 06:30 AM
        // const cron = "cron(30 0 * * ? *)"; // At 00:30 AM
        const cron = "cron(0 * * * ? *)";
        const crawlerName = `${this._provisionerName}-${subFolder}-cwr`;
        const _crawler = new aws.glue.Crawler(crawlerName, {
            databaseName: db.name,
            role: glueRole.arn,
            s3Targets: [{
                    path: Pulumi.interpolate `s3://${this._bucketId}/${subFolder}`
                }],
            recrawlPolicy: {
                // recrawlBehavior: "CRAWL_EVERYTHING"
                recrawlBehavior: "CRAWL_NEW_FOLDERS_ONLY"
            },
            schedule: cron,
            schemaChangePolicy: {
                deleteBehavior: "LOG",
                // deleteBehavior: "DEPRECATE_IN_DATABASE",
                updateBehavior: "LOG"
                // updateBehavior: "UPDATE_IN_DATABASE"
            },
            configuration: `{
                "Version": 1.0,
                "CrawlerOutput": {
                    "Partitions": {
                        "AddOrUpdateBehavior": "InheritFromTable"
                    },
                    "Tables": {
                        "AddOrUpdateBehavior": "MergeNewColumns"
                    }
                }
            }`
            // tablePrefix: "canary-fls" // table name will be the s3 subfolder
        });
        return this;
    }
    _provisionGlueRole() {
        if (this._glueRole == null) {
            const roleName = `${this._provisionerName}-glue-rle`;
            this._glueRole = new aws.iam.Role(roleName, {
                assumeRolePolicy: JSON.stringify({
                    Version: "2012-10-17",
                    Statement: [
                        {
                            Action: "sts:AssumeRole",
                            Effect: "Allow",
                            Principal: {
                                Service: "glue.amazonaws.com"
                            }
                        }
                    ]
                }),
                managedPolicyArns: [
                    aws.iam.ManagedPolicy.AmazonS3FullAccess,
                    "arn:aws:iam::aws:policy/service-role/AWSGlueServiceRole"
                ],
                tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: roleName })
            });
        }
        return this._glueRole;
    }
    _provisionGlueDb() {
        if (this._glueDb == null) {
            const dbName = `${this._provisionerName}-db`;
            this._glueDb = new aws.glue.CatalogDatabase(dbName, {
                name: dbName,
                // TODO: catalogId should be explicitly managed, otherwise we end up in AwsDataCatalog
                tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: dbName })
            });
        }
        return this._glueDb;
    }
}
//# sourceMappingURL=s3bucket-details.js.map