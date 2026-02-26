import { given } from "@nivinjoseph/n-defensive";
import * as aws from "@pulumi/aws";
import { NfraConfig } from "../../common/nfra-config.js";
import { RabbitAmazonmqConfig } from "./rabbit-amazonmq-config.js";
import { RabbitAmazonmqDetails } from "./rabbit-amazonmq-details.js";
import * as Random from "@pulumi/random";
import * as Pulumi from "@pulumi/pulumi";


export class RabbitAmazonmqProvisioner
{
    private readonly _name: string;
    private readonly _config: RabbitAmazonmqConfig;


    public constructor(name: string, config: RabbitAmazonmqConfig)
    {
        // this._name = CommonHelper.prefixName(name);
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name;

        given(config, "config").ensureHasValue().ensureIsObject()
            .ensureHasStructure({
                vpcDetails: "object",
                subnetNamePrefix: "string",
                ingressSubnetNamePrefixes: ["string"],
                instanceType: "string",
                "username?": "string",
                "password?": "string",
                "isHA?": "boolean"
            });
        this._config = config;
    }


    public provision(): RabbitAmazonmqDetails
    {
        const engineVersion = "3.13"; // Valid values: [3.13, 3.12.13, 3.11.28, 3.11.20, 3.11.16, 3.10.25, 3.10.20, 3.10.10, 3.9.27, 3.9.24, 3.9.16, 3.9.13, 3.8.34, 3.8.30, 3.8.27, 3.8.26, 3.8.23, 3.8.22, 3.8.11, 3.8.6]

        const rabbitPort = 5671;

        const ingressCidrBlocks = this._config.vpcDetails
            .resolveSubnets(this._config.ingressSubnetNamePrefixes)
            .map(t => t.cidrBlock);

        const secGroupName = `${this._name}-rab-sg`;
        const secGroup = new aws.ec2.SecurityGroup(secGroupName, {
            vpcId: this._config.vpcDetails.vpc.id,
            revokeRulesOnDelete: true,
            ingress: [
                {
                    protocol: "tcp",
                    fromPort: rabbitPort,
                    toPort: rabbitPort,
                    cidrBlocks: ingressCidrBlocks
                },
                {
                    protocol: "tcp",
                    fromPort: 443,
                    toPort: 443, // FIXME: this needs to be properly scoped
                    cidrBlocks: ingressCidrBlocks
                }
            ],
            tags: {
                ...NfraConfig.tags,
                Name: secGroupName
            }
        }, {
            // replaceOnChanges: ["*"]
        });

        const username = this._config.username ?? "appuser";
        const password = this._config.password ?? this._createPassword();

        const mqSubnets = this._config.vpcDetails
            .resolveSubnets([this._config.subnetNamePrefix]);

        const rabbitBrokerName = `${this._name}-rab-amq`;
        const rabbitBroker = new aws.mq.Broker(rabbitBrokerName, {
            brokerName: rabbitBrokerName,
            engineType: "RabbitMQ",
            engineVersion,
            hostInstanceType: this._config.instanceType,
            applyImmediately: true,
            authenticationStrategy: "simple",
            autoMinorVersionUpgrade: true, // this has to be true for 3.13 and up
            deploymentMode: this._config.isHA ? "CLUSTER_MULTI_AZ" : "SINGLE_INSTANCE",
            logs: { general: true },
            maintenanceWindowStartTime: {
                dayOfWeek: "TUESDAY",
                timeOfDay: "02:00",
                timeZone: "America/Los_Angeles"
            },
            publiclyAccessible: false,
            securityGroups: [secGroup.id],
            storageType: "ebs",
            subnetIds: mqSubnets
                .map(t => t.id).take(this._config.isHA ? 3 : 1), // tied to deployment mode
            users: [{
                username,
                password
            }],
            // configuration: rabbitConfiguration,
            tags: {
                ...NfraConfig.tags,
                Name: rabbitBrokerName
            }
        }, {ignoreChanges: ["engineVersion"]});

        const rabbitEndpoint = rabbitBroker.instances[0].endpoints[0]
            .apply(t => t.replace("amqps://", "").split(":")[0]);

        // rabbitBroker.instances.apply(t =>
        // {
        //     return Promise.all([
        //         Logger.logWarning(`Rabbit instance count => ${t.length}`),
        //         Logger.logWarning(`Rabbit endpoints ${t.map(u => u.endpoints)}`)
        //     ]);
        // });

        return {
            host: rabbitEndpoint,
            port: rabbitPort,
            username: Pulumi.output(username),
            password: Pulumi.output(password)
        };
    }

    private _createPassword(): Pulumi.Output<string>
    {
        const password = new Random.RandomPassword(`${this._name}-rpass`, {
            length: 16,
            special: true,
            overrideSpecial: `_`
        });

        return password.result;
    }
}