import { given } from "@nivinjoseph/n-defensive";
import { KafkaMskProvisionedConfig } from "./kafka-msk-provisioned-config.js";
import { KafkaMskProvisionedDetails } from "./kafka-msk-provisioned-details.js";
import * as aws from "@pulumi/aws";
import { NfraConfig } from "../../common/nfra-config.js";
import { Duration } from "@nivinjoseph/n-util";
import { SecurityGroupHelper } from "../../vpc/security-group-helper.js";


export class KafkaMskProvisionedProvisioner
{
    private readonly _name: string;
    private readonly _config: KafkaMskProvisionedConfig;


    public constructor(name: string, config: KafkaMskProvisionedConfig)
    {
        // this._name = CommonHelper.prefixName(name);
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name;

        given(config, "config").ensureHasValue().ensureIsObject()
            .ensureHasStructure({
                vpcDetails: "object",
                subnetNamePrefix: "string",
                ingressSubnetNamePrefixes: ["string"],
                numBrokers: "number",
                instanceClass: "string",
                storageGb: "number",
                "makePublic?": "boolean"
            })
            .ensure(t => t.storageGb >= 1 && t.storageGb <= 16384,
                "storageGb must be >= 1 and <= 16384");
        this._config = config;
    }


    public provision(): KafkaMskProvisionedDetails
    {
        // https://docs.aws.amazon.com/msk/latest/developerguide/port-info.html
        const kafkaIamPort = 9098;
        const kafkaIamPortPublic = 9198;

        const ingressPorts = [kafkaIamPort];
        if (this._config.makePublic)
            ingressPorts.push(kafkaIamPortPublic);

        // TODO: conditionally open ports
        // ingressPorts.push(9092); // To communicate with brokers in plaintext, use port 9092
        // ingressPorts.push(9094); // To communicate with brokers with TLS encryption, use port 9094 for access from within AWS
        // ingressPorts.push(9194); // To communicate with brokers with TLS encryption, use port 9194 for public access
        // ingressPorts.push(9096); // To communicate with brokers with SASL/SCRAM, use port 9096 for access from within AWS
        // ingressPorts.push(9196); // To communicate with brokers with SASL/SCRAM, use port 9196 for public access
        // ingressPorts.push(9098); // To communicate with brokers in a cluster that is set up to use IAM access control, use port 9098 for access from within AWS
        // ingressPorts.push(9198); // To communicate with brokers in a cluster that is set up to use IAM access control, use port 9198 for public access
        // ignoring zookeeper ports for now

        const ingressCidrBlocks = SecurityGroupHelper.resolveCidrBlocks(
            this._config.vpcDetails, this._config.ingressSubnetNamePrefixes);

        const secGroupName = `${this._name}-sg`;
        const secGroup = new aws.ec2.SecurityGroup(secGroupName, {
            vpcId: this._config.vpcDetails.vpc.id,
            revokeRulesOnDelete: true,
            ingress: ingressPorts
                .map(port => ({
                    protocol: "tcp",
                    fromPort: port,
                    toPort: port,
                    cidrBlocks: ingressCidrBlocks
                })),
            tags: {
                ...NfraConfig.tags,
                Name: secGroupName
            }
        });

        // https://docs.aws.amazon.com/msk/latest/developerguide/msk-configuration-properties.html
        // https://docs.aws.amazon.com/msk/latest/developerguide/msk-default-configuration.html
        // https://kafka.apache.org/documentation/#configuration

        const configurationName = `${this._name}-cfg`;
        const configuration = new aws.msk.Configuration(configurationName, {
            name: configurationName,
            kafkaVersions: ["3.7.x"],
            serverProperties: `
            allow.everyone.if.no.acl.found = true
            auto.create.topics.enable = false
            delete.topic.enable = true
            log.retention.ms = ${Duration.fromDays(7).toMilliSeconds()}
            `
        });

        const logGroupName = `${this._name}-msk-log-grp`; // https://docs.datadoghq.com/integrations/amazon_msk/#log-collection
        const logGroup = new aws.cloudwatch.LogGroup(logGroupName, {
            name: logGroupName,
            skipDestroy: false,
            tags: {
                ...NfraConfig.tags,
                Name: logGroupName
            }
        });

        const kafkaSubnets = this._config.vpcDetails
            .resolveSubnets([this._config.subnetNamePrefix]);

        const connectivityInfo = this._config.makePublic
            ? {
                publicAccess: {
                    // type: "DISABLED",
                    type: "SERVICE_PROVIDED_EIPS"
                }
                // vpcConnectivity: {
                //     clientAuthentication: {
                //         sasl: {
                //             iam: true,
                //             scram: false
                //         },
                //         tls: undefined
                //     }
                // }
            }
            : undefined;

        const clusterName = `${this._name}-cls`;
        const cluster = new aws.msk.Cluster(clusterName, {
            clusterName: clusterName,
            kafkaVersion: "3.7.x",
            numberOfBrokerNodes: this._config.numBrokers,
            brokerNodeGroupInfo: {
                instanceType: this._config.instanceClass,
                clientSubnets: kafkaSubnets.take(this._config.numBrokers)
                    .map(u => u.id),
                storageInfo: {
                    ebsStorageInfo: {
                        volumeSize: this._config.storageGb
                    }
                },
                azDistribution: "DEFAULT",
                connectivityInfo,
                securityGroups: [secGroup.id]
            },
            encryptionInfo: {
                encryptionAtRestKmsKeyArn: undefined,
                encryptionInTransit: {
                    clientBroker: "TLS",
                    inCluster: true
                }
            },
            storageMode: this._config.instanceClass === "kafka.t3.small" ? "LOCAL" : "TIERED",
            clientAuthentication: {
                sasl: {
                    iam: true,
                    scram: false
                },
                tls: undefined,
                unauthenticated: false
            },
            enhancedMonitoring: "PER_TOPIC_PER_PARTITION",
            configurationInfo: {
                arn: configuration.arn,
                revision: configuration.latestRevision
            },
            openMonitoring: {
                prometheus: {
                    jmxExporter: {
                        enabledInBroker: true
                    },
                    nodeExporter: {
                        enabledInBroker: true
                    }
                }
            },
            loggingInfo: {
                brokerLogs: {
                    cloudwatchLogs: {
                        enabled: true,
                        logGroup: logGroup.name
                    }
                }
            },
            tags: {
                ...NfraConfig.tags,
                Name: clusterName
            }
        });

        return {
            clusterUuid: cluster.clusterUuid,
            clusterName: cluster.clusterName,
            clusterArn: cluster.arn,
            bootstrapBrokers: cluster.bootstrapBrokersSaslIam,
            bootstrapBrokersPublic: this._config.makePublic ? cluster.bootstrapBrokersPublicSaslIam : undefined
        };
    }
}