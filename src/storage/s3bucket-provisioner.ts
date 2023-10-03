import { given } from "@nivinjoseph/n-defensive";
// import { PolicyDocument, PolicyStatement } from "@pulumi/aws/iam";
import * as aws from "@pulumi/aws";
// import { Bucket, BucketPolicy, BucketPublicAccessBlock } from "@pulumi/aws/s3";
import * as Pulumi from "@pulumi/pulumi";
import { NfraConfig } from "../nfra-config";
import { PolicyDocument } from "../security/policy/policy-document";
import { S3bucketAccessPolicyConfig } from "./s3bucket-access-policy-config";
import { S3bucketConfig } from "./s3bucket-config";
import { S3bucketDetails } from "./s3bucket-details";


export class S3bucketProvisioner
{
    private readonly _name: string;
    private readonly _config: S3bucketConfig;
    
    
    public constructor(name: string, config: S3bucketConfig)
    {
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
        
        given(config, "config").ensureHasValue()
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
            .ensureWhen(config.bucketName.contains("."), t => !t.enableTransferAcceleration,
                "S3 Transfer Acceleration is not supported for buckets with periods (.) in their names")
            .ensureWhen(config.accessConfig != null, t => t.accessConfig!.isNotEmpty, "accessConfig cannot be empty if provided")
            .ensureWhen(config.accessConfig != null, t => t.accessConfig!.every(
                u => !(u.userOrRoleArn == null && u.awsService == null) && !(u.userOrRoleArn != null && u.awsService != null)
            ), "only one of userOrRoleArn or awsService must be provided in accessConfig")
            .ensureWhen(config.accessConfig != null, t => t.accessConfig!.every(u => u.accessControls.isNotEmpty),
                "accessControls cannot be empty in accessConfig")
            .ensureWhen(config.accessConfig != null, t => t.accessConfig!.every(u => u.accessControls.every(v => ["GET", "PUT"].contains(v))),
                "only GET and PUT are allowed in accessControls within accessConfig");
        
        config.enableTransferAcceleration ??= false;   
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
    
    public static createAccessPolicyDocument(config: S3bucketAccessPolicyConfig): PolicyDocument
    {
        given(config, "config").ensureHasValue()
            .ensureHasStructure({
                bucketDetails: "object",
                accessControls: ["string"]
            })
            .ensure(t => t.accessControls.isNotEmpty, "accessControls cannot be empty")
            .ensure(t => t.accessControls.every(u => ["GET", "PUT"].contains(u)),
                "only GET and PUT are allowed in accessControls");
        
        const allowedActions = new Array<string>();
        if (config.accessControls.contains("GET"))
            allowedActions.push("s3:GetObject");
        if (config.accessControls.contains("PUT"))
            allowedActions.push("s3:PutObject", "s3:PutObjectAcl");
        
        const policy: aws.iam.PolicyDocument = {
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Action: allowedActions,
                    Resource: Pulumi.interpolate`${config.bucketDetails.bucketArn}/*`
                }
            ]
        };
        
        return policy;
    }
    
    public provision(): S3bucketDetails
    {
        const bucketName = this._config.bucketName;
        const bucket = new aws.s3.Bucket(bucketName, {
            accelerationStatus: this._config.enableTransferAcceleration ? "Enabled" : undefined,
            serverSideEncryptionConfiguration: {
                rule: {
                    applyServerSideEncryptionByDefault: {
                        sseAlgorithm: "AES256"
                    },
                    bucketKeyEnabled: true
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
            tags: {
                ...NfraConfig.tags,
                Name: bucketName
            }
        });

        new aws.s3.BucketPublicAccessBlock(`${this._name}-bucket-pab`, {
            bucket: bucket.id,
            blockPublicAcls: !this._config.isPublic,
            ignorePublicAcls: !this._config.isPublic,
            blockPublicPolicy: true,
            restrictPublicBuckets: true
        });
        
        if (this._config.isPublic)
        {
            new aws.s3.BucketOwnershipControls(`${this._name}-bucket-oc`, {
                bucket: bucket.id,
                rule: {
                    objectOwnership: "BucketOwnerPreferred"
                }
            });
        }

        const policy: aws.iam.PolicyDocument = {
            Version: "2012-10-17",
            Id: `${this._name}-policy`,
            Statement: [
                {
                    Effect: "Deny",
                    Principal: "*",
                    Action: "s3:*",
                    Resource: [
                        bucket.arn,
                        Pulumi.interpolate`${bucket.arn}/*`
                    ],
                    Condition: {
                        "Bool": {
                            "aws:SecureTransport": "false"
                        }
                    }
                },
                ...this._config.accessConfig != null
                    ? this._config.accessConfig.map(config =>
                    {
                        const allowedActions = new Array<string>();
                        if (config.accessControls.contains("GET"))
                            allowedActions.push("s3:GetObject");
                        if (config.accessControls.contains("PUT"))
                            allowedActions.push("s3:PutObject", "s3:PutObjectAcl");
                        
                        const st: aws.iam.PolicyStatement = {
                            Effect: "Allow",
                            Principal: config.userOrRoleArn != null
                                ? { AWS: config.userOrRoleArn }
                                : { Service: config.awsService! },
                            Action: allowedActions,
                            Resource: Pulumi.interpolate`${bucket.arn}/*`
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