import { given } from "@nivinjoseph/n-defensive";
import * as aws from "@pulumi/aws";
import { NfraConfig } from "../../common/nfra-config.js";
import { SecurityGroupHelper } from "../../vpc/security-group-helper.js";
export class KafkaMskServerlessProvisioner {
    constructor(name, config) {
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name.trim();
        given(config, "config").ensureHasValue().ensureIsObject().ensureHasStructure({
            vpcDetails: "object",
            subnetNamePrefix: "string",
            ingressSubnetNamePrefixes: ["string"]
        });
        this._config = config;
    }
    provision() {
        // https://docs.aws.amazon.com/msk/latest/developerguide/port-info.html
        const kafkaIamPort = 9098;
        const ingressPorts = [kafkaIamPort];
        const ingressCidrBlocks = SecurityGroupHelper.resolveCidrBlocks(this._config.vpcDetails, this._config.ingressSubnetNamePrefixes);
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
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: secGroupName })
        });
        const kafkaSubnets = this._config.vpcDetails
            .resolveSubnets([this._config.subnetNamePrefix]);
        const clusterName = `${this._name}-cls`;
        const cluster = new aws.msk.ServerlessCluster(clusterName, {
            clientAuthentication: {
                sasl: {
                    iam: {
                        enabled: true
                    }
                }
            },
            vpcConfigs: [{
                    subnetIds: kafkaSubnets
                        .map(t => t.id),
                    securityGroupIds: [secGroup.id]
                }],
            clusterName,
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: clusterName })
        });
        const bootstrapBrokers = aws.msk.getBootstrapBrokersOutput({
            clusterArn: cluster.arn
        });
        return {
            clusterName: cluster.clusterName,
            clusterArn: cluster.arn,
            bootstrapBrokers: bootstrapBrokers.bootstrapBrokersSaslIam
        };
    }
}
//# sourceMappingURL=kafka-msk-serverless-provisioner.js.map