import { given } from "@nivinjoseph/n-defensive";
import { NlbDetails } from "./nlb-details.js";
// import * as awsx from "@pulumi/awsx";
import { NfraConfig } from "../../common/nfra-config.js";
import * as aws from "@pulumi/aws";
export class NlbProvisioner {
    constructor(name, config) {
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name.trim();
        given(config, "config").ensureHasValue().ensureIsObject()
            .ensureHasStructure({
            vpcDetails: "object",
            subnetNamePrefix: "string",
            port: "number"
            // targetIp: "object"
        });
        this._config = config;
    }
    provision() {
        const serviceSubnets = this._config.vpcDetails
            .resolveSubnets([this._config.subnetNamePrefix])
            .map(u => u.id);
        // .apply(t => t.map(u => u.id));
        const nlbName = `${this._name}-nlb`;
        const nlb = new aws.lb.LoadBalancer(nlbName, {
            // vpc: this._config.vpcDetails.vpc,
            internal: true,
            ipAddressType: "ipv4",
            loadBalancerType: "network",
            subnets: serviceSubnets,
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: nlbName })
        });
        const targetGroupName = `${this._name}-tgp`;
        const targetGroup = new aws.lb.TargetGroup(targetGroupName, {
            protocol: "TCP",
            port: this._config.port,
            targetType: "ip",
            vpcId: this._config.vpcDetails.vpc.id,
            healthCheck: {
                interval: 30,
                healthyThreshold: 3,
                unhealthyThreshold: 3,
                protocol: "TCP",
                port: this._config.port.toString()
            },
            deregistrationDelay: 60,
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: targetGroupName })
        });
        new aws.lb.TargetGroupAttachment(`${this._name}-tga`, {
            targetGroupArn: targetGroup.arn,
            targetId: this._config.targetIp,
            port: this._config.port
        }, {
            dependsOn: [nlb, targetGroup]
        });
        const listenerName = `${this._name}-lnr`;
        new aws.lb.Listener(listenerName, {
            loadBalancerArn: nlb.arn,
            protocol: "TCP",
            port: this._config.port,
            defaultActions: [{
                    type: "forward",
                    targetGroupArn: targetGroup.arn
                }],
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: listenerName })
        }, {
            parent: nlb,
            dependsOn: [targetGroup]
        });
        return new NlbDetails(nlb.arn, nlb.dnsName, this._config.port);
    }
}
//# sourceMappingURL=nlb-provisioner.js.map