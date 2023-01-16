"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3bucketProvisioner = void 0;
const n_defensive_1 = require("@nivinjoseph/n-defensive");
// import { PolicyDocument, PolicyStatement } from "@pulumi/aws/iam";
const aws = require("@pulumi/aws");
// import { Bucket, BucketPolicy, BucketPublicAccessBlock } from "@pulumi/aws/s3";
const Pulumi = require("@pulumi/pulumi");
const nfra_config_1 = require("../nfra-config");
class S3bucketProvisioner {
    constructor(name, config) {
        var _a;
        (0, n_defensive_1.given)(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
        (0, n_defensive_1.given)(config, "config").ensureHasValue()
            .ensureHasStructure({
            bucketName: "string",
            isPublic: "boolean",
            "enableTransferAcceleration?": "boolean",
            "accessConfig?": [{
                    "userOrRoleArn?": "object",
                    "awsService?": "string",
                    accessControls: ["string"]
                }]
        })
            .ensureWhen(config.bucketName.contains("."), t => !t.enableTransferAcceleration, "S3 Transfer Acceleration is not supported for buckets with periods (.) in their names")
            .ensureWhen(config.accessConfig != null, t => t.accessConfig.isNotEmpty, "accessConfig cannot be empty if provided")
            .ensureWhen(config.accessConfig != null, t => t.accessConfig.every(u => !(u.userOrRoleArn == null && u.awsService == null) && !(u.userOrRoleArn != null && u.awsService != null)), "only one of userOrRoleArn or awsService must be provided in accessConfig")
            .ensureWhen(config.accessConfig != null, t => t.accessConfig.every(u => u.accessControls.isNotEmpty), "accessControls cannot be empty in accessConfig")
            .ensureWhen(config.accessConfig != null, t => t.accessConfig.every(u => u.accessControls.every(v => ["GET", "PUT"].contains(v))), "only GET and PUT are allowed in accessControls within accessConfig");
        (_a = config.enableTransferAcceleration) !== null && _a !== void 0 ? _a : (config.enableTransferAcceleration = false);
        this._config = config;
    }
    // public static provisionAccess(name: string, config: S3bucketAccessConfig): void
    // {
    //     given(name, "name").ensureHasValue().ensureIsString();
    //     given(config, "config").ensureHasValue()
    //         .ensureHasStructure({
    //             bucketDetails: "object",
    //             "userOrRoleArn?": "object",
    //             "awsService?": "string",
    //             accessControls: ["string"]
    //         })
    //         .ensure(t => !(t.userOrRoleArn == null && t.awsService == null) && !(t.userOrRoleArn != null && t.awsService != null),
    //             "only one of userOrRoleArn or awsService must be provided")
    //         .ensure(t => t.accessControls.isNotEmpty, "accessControls cannot be empty")
    //         .ensure(t => t.accessControls.every(u => ["GET", "PUT"].contains(u)),
    //             "only GET and PUT are allowed in accessControls");
    //     const allowedActions = new Array<string>();
    //     if (config.accessControls.contains("GET"))
    //         allowedActions.push("s3:GetObject");
    //     if (config.accessControls.contains("PUT"))
    //         allowedActions.push("s3:PutObject", "s3:PutObjectAcl");
    //     const policy: aws.iam.PolicyDocument = {
    //         Version: "2012-10-17",
    //         Id: `${name}-acc-policy`,
    //         Statement: [
    //             {
    //                 Sid: `${name}-acc`,
    //                 Effect: "Allow",
    //                 Principal: config.userOrRoleArn != null
    //                     ? { AWS: config.userOrRoleArn }
    //                     : { Service: config.awsService! },
    //                 Action: allowedActions,
    //                 Resource: Pulumi.interpolate`${config.bucketDetails.bucketArn}/*`
    //             }
    //         ]
    //     };
    //     new aws.s3.BucketPolicy(`${name}-bucket-acc-pol`, {
    //         bucket: config.bucketDetails.bucketId,
    //         policy
    //     });
    // }
    static createAccessPolicyDocument(config) {
        (0, n_defensive_1.given)(config, "config").ensureHasValue()
            .ensureHasStructure({
            bucketDetails: "object",
            accessControls: ["string"]
        })
            .ensure(t => t.accessControls.isNotEmpty, "accessControls cannot be empty")
            .ensure(t => t.accessControls.every(u => ["GET", "PUT"].contains(u)), "only GET and PUT are allowed in accessControls");
        const allowedActions = new Array();
        if (config.accessControls.contains("GET"))
            allowedActions.push("s3:GetObject");
        if (config.accessControls.contains("PUT"))
            allowedActions.push("s3:PutObject", "s3:PutObjectAcl");
        const policy = {
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Action: allowedActions,
                    Resource: Pulumi.interpolate `${config.bucketDetails.bucketArn}/*`
                }
            ]
        };
        return policy;
    }
    provision() {
        const bucketName = this._config.bucketName;
        const bucket = new aws.s3.Bucket(bucketName, {
            accelerationStatus: this._config.enableTransferAcceleration ? "Enabled" : undefined,
            serverSideEncryptionConfiguration: {
                rule: {
                    applyServerSideEncryptionByDefault: {
                        sseAlgorithm: "AES256"
                    },
                    bucketKeyEnabled: false
                }
            },
            acl: "private",
            // loggings: [
            //     {
            //         targetBucket: `target.bucket`,
            //         targetPrefix: "bucket_logs/"
            //     }
            // ],
            corsRules: [
                {
                    allowedHeaders: ["*"],
                    allowedMethods: ["GET", "PUT"],
                    allowedOrigins: ["*"],
                    exposeHeaders: []
                }
            ],
            forceDestroy: true,
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: bucketName })
        });
        new aws.s3.BucketPublicAccessBlock(`${this._name}-bucket-pab`, {
            bucket: bucket.id,
            blockPublicAcls: !this._config.isPublic,
            ignorePublicAcls: !this._config.isPublic,
            blockPublicPolicy: true,
            restrictPublicBuckets: true
        });
        const policy = {
            Version: "2012-10-17",
            Id: `${this._name}-policy`,
            Statement: [
                {
                    Effect: "Deny",
                    Principal: "*",
                    Action: "s3:*",
                    Resource: [
                        bucket.arn,
                        Pulumi.interpolate `${bucket.arn}/*`
                    ],
                    Condition: {
                        "Bool": {
                            "aws:SecureTransport": "false"
                        }
                    }
                },
                ...this._config.accessConfig != null
                    ? this._config.accessConfig.map(config => {
                        const allowedActions = new Array();
                        if (config.accessControls.contains("GET"))
                            allowedActions.push("s3:GetObject");
                        if (config.accessControls.contains("PUT"))
                            allowedActions.push("s3:PutObject", "s3:PutObjectAcl");
                        const st = {
                            Effect: "Allow",
                            Principal: config.userOrRoleArn != null
                                ? { AWS: config.userOrRoleArn }
                                : { Service: config.awsService },
                            Action: allowedActions,
                            Resource: Pulumi.interpolate `${bucket.arn}/*`
                        };
                        return st;
                    })
                    : []
            ]
        };
        new aws.s3.BucketPolicy(`${this._name}-bucket-pol`, {
            bucket: bucket.id,
            policy
        });
        return {
            bucketId: bucket.id,
            bucketArn: bucket.arn
        };
    }
}
exports.S3bucketProvisioner = S3bucketProvisioner;
//# sourceMappingURL=s3bucket-provisioner.js.map