import { given } from "@nivinjoseph/n-defensive";
// import { PolicyDocument, PolicyStatement } from "@pulumi/aws/iam";
import * as aws from "@pulumi/aws";
// import { Bucket, BucketPolicy, BucketPublicAccessBlock } from "@pulumi/aws/s3";
import * as Pulumi from "@pulumi/pulumi";
import { NfraConfig } from "../nfra-config";
import { PolicyDocument } from "../security/policy/policy-document";
import { S3bucketAccessConfig } from "./s3bucket-access-config";
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
        
        given(config, "config").ensureHasValue().ensureHasStructure({
            bucketName: "string",
            isPublic: "boolean",
            "enableTransferAcceleration?": "boolean",
            "accessUserArn?": "object"
        }).ensureWhen(config.bucketName.contains("."), t => !!t.enableTransferAcceleration,
            "S3 Transfer Acceleration is not supported for buckets with periods (.) in their names");
        
        config.enableTransferAcceleration ??= false;   
        this._config = config;
    }
    
    public static provisionAccess(name: string, config: S3bucketAccessConfig): void
    {
        given(name, "name").ensureHasValue().ensureIsString();
        given(config, "config").ensureHasValue().ensureHasStructure({
            bucketDetails: "object",
            "userOrRoleArn?": "object",
            "awsService?": "string",
            accessControls: ["string"]
        }).ensure(t => !(t.userOrRoleArn == null && t.awsService == null) && !(t.userOrRoleArn != null && t.awsService != null),
            "only one of userOrRoleArn or awsService must be provided");
        
        const allowedActions = new Array<string>();
        if (config.accessControls.contains("GET"))
            allowedActions.push("s3:GetObject");
        if (config.accessControls.contains("PUT"))
            allowedActions.push("s3:PutObject", "s3:PutObjectAcl");
        
        const policy: aws.iam.PolicyDocument = {
            Version: "2012-10-17",
            Id: `${name}-policy`,
            Statement: [
                {
                    Effect: "Allow",
                    Principal: config.userOrRoleArn != null
                        ? { AWS: config.userOrRoleArn }
                        : { Service: config.awsService! },
                    Action: allowedActions,
                    Resource: Pulumi.interpolate`${config.bucketDetails.bucketArn}/*`
                }
            ]
        };
        
        new aws.s3.BucketPolicy(`${name}-bucket-pol`, {
            bucket: config.bucketDetails.bucketId,
            policy
        });
    }
    
    public static createAccessPolicyDocument(config: Pick<S3bucketAccessConfig, "bucketDetails" | "accessControls">): PolicyDocument
    {
        given(config, "config").ensureHasValue().ensureHasStructure({
            bucketDetails: "object",
            accessControls: ["string"]
        });
        
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
                    bucketKeyEnabled: false
                }
            },
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

        const bucketPublicAccessBlock = new aws.s3.BucketPublicAccessBlock(`${this._name}-bucket-pab`, {
            bucket: bucket.id,
            blockPublicAcls: !this._config.isPublic,
            ignorePublicAcls: !this._config.isPublic,
            blockPublicPolicy: true,
            restrictPublicBuckets: true
        });

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
                }
            ]
        };
        
        new aws.s3.BucketPolicy(`${this._name}-bucket-pol`, {
            bucket: bucket.id,
            policy
        }, { dependsOn: bucketPublicAccessBlock });
        
        return {
            bucketId: bucket.id,
            bucketArn: bucket.arn
        };
    }
}