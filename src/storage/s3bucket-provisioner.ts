import { given } from "@nivinjoseph/n-defensive";
import { PolicyDocument, PolicyStatement } from "@pulumi/aws/iam";
import { Bucket, BucketPolicy, BucketPublicAccessBlock } from "@pulumi/aws/s3";
import * as Pulumi from "@pulumi/pulumi";
import { InfraConfig } from "../infra-config";
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
    
    public provision(): S3bucketDetails
    {
        const bucketName = this._config.bucketName;
        const bucket = new Bucket(bucketName, {
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
                ...InfraConfig.tags,
                Name: bucketName
            }
        });

        const bucketPublicAccessBlock = new BucketPublicAccessBlock(`${this._name}-bucket-pab`, {
            bucket: bucket.id,
            blockPublicAcls: !this._config.isPublic,
            ignorePublicAcls: !this._config.isPublic,
            blockPublicPolicy: true,
            restrictPublicBuckets: true
        });

        const policy: PolicyDocument = {
            Version: "2012-10-17",
            Id: `${this._name}-policy`,
            Statement: [
                ...this._config.accessUserArn != null ? [
                    {
                        Sid: "Stmt1",
                        Effect: "Allow",
                        Principal: {
                            AWS: this._config.accessUserArn
                        },
                        Action: [
                            "s3:GetObject",
                            "s3:PutObject",
                            "s3:PutObjectAcl"
                        ],
                        Resource: Pulumi.interpolate`${bucket.arn}/*`
                    } as PolicyStatement
                ] : [],
                {
                    Sid: "Stmt2",
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
        
        new BucketPolicy(`${this._name}-bucket-pol`, {
            bucket: bucket.id,
            policy
        }, { dependsOn: bucketPublicAccessBlock });
        
        return {
            bucketId: bucket.id,
            bucketArn: bucket.arn
        };
    }
}