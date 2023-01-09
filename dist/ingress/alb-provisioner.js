"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlbProvisioner = void 0;
const n_defensive_1 = require("@nivinjoseph/n-defensive");
const ec2_1 = require("@pulumi/awsx/ec2");
const Pulumi = require("@pulumi/pulumi");
const infra_config_1 = require("../infra-config");
const lb_1 = require("@pulumi/awsx/lb");
const lb_2 = require("@pulumi/aws/lb");
const wafv2_1 = require("@pulumi/aws/wafv2");
const cloudfront_1 = require("@pulumi/aws/cloudfront");
class AlbProvisioner {
    constructor(name, vpcDetails, config) {
        var _a, _b;
        (0, n_defensive_1.given)(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
        (0, n_defensive_1.given)(vpcDetails, "vpcDetails").ensureHasValue().ensureIsObject();
        this._vpcDetails = vpcDetails;
        (0, n_defensive_1.given)(config, "config").ensureHasValue().ensureIsObject()
            .ensureHasStructure({
            subnetNamePrefix: "string",
            egressSubnetNamePrefixes: ["string"],
            certificateArn: "string",
            "enableWaf?": "boolean",
            "enableCloudfront?": "boolean",
            targets: [{
                    host: "string",
                    "slowStart?": "number",
                    "healthCheckPath": "string"
                }]
        })
            .ensure(t => t.targets.isNotEmpty, "at least 1 target must be provided")
            .ensure(t => t.targets.distinct(u => u.host).length === t.targets.length, "hosts must be distinct");
        const { targets } = config;
        targets.forEach(target => {
            (0, n_defensive_1.given)(target, "target")
                .ensure(t => t.slowStart == null || (t.slowStart >= 30 && t.slowStart <= 900), "slowStart value has to be between 30 and 900 inclusive")
                .ensure(t => t.host.length <= 128, "host length cannot be over 128 characters");
        });
        (_a = config.enableWaf) !== null && _a !== void 0 ? _a : (config.enableWaf = false);
        (_b = config.enableCloudfront) !== null && _b !== void 0 ? _b : (config.enableCloudfront = false);
        this._config = config;
    }
    provision() {
        const albSecGroupName = `${this._name}-sg`;
        const appAlbSecGroup = new ec2_1.SecurityGroup(albSecGroupName, {
            vpc: this._vpcDetails.vpc,
            ingress: [
                {
                    protocol: "tcp",
                    fromPort: 80,
                    toPort: 80,
                    cidrBlocks: ["0.0.0.0/0"]
                },
                {
                    protocol: "tcp",
                    fromPort: 443,
                    toPort: 443,
                    cidrBlocks: ["0.0.0.0/0"]
                }
            ],
            egress: [{
                    protocol: "tcp",
                    fromPort: 80,
                    toPort: 80,
                    cidrBlocks: Pulumi.output(this._vpcDetails.vpc.getSubnets("private"))
                        .apply((subnets) => subnets.where(subnet => this._config.egressSubnetNamePrefixes.some(prefix => subnet.subnetName.startsWith(prefix)))
                        .map(t => t.subnet.cidrBlock))
                }],
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: albSecGroupName })
        });
        const albName = `${this._name}-alb`;
        const alb = new lb_1.ApplicationLoadBalancer(albName, {
            external: true,
            ipAddressType: "ipv4",
            vpc: this._vpcDetails.vpc,
            subnets: Pulumi.output(this._vpcDetails.vpc.getSubnets("public"))
                .apply((subnets) => subnets.where(t => t.subnetName.startsWith(this._config.subnetNamePrefix)).map(t => t.id)),
            securityGroups: [appAlbSecGroup],
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: albName })
        });
        const httpListenerName = `${this._name}-http-lnr`;
        new lb_2.Listener(httpListenerName, {
            loadBalancerArn: alb.loadBalancer.arn,
            protocol: "HTTP",
            port: 80,
            defaultActions: [{
                    type: "redirect",
                    redirect: {
                        protocol: "HTTPS",
                        port: "443",
                        statusCode: "HTTP_301"
                    }
                }],
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: httpListenerName })
        }, { parent: alb });
        const httpsListenerName = `${this._name}-https-lnr`;
        const httpsListener = new lb_2.Listener(httpsListenerName, {
            loadBalancerArn: alb.loadBalancer.arn,
            protocol: "HTTPS",
            port: 443,
            certificateArn: this._config.certificateArn,
            sslPolicy: "ELBSecurityPolicy-2016-08",
            defaultActions: [{
                    type: "fixed-response",
                    fixedResponse: {
                        contentType: "text/plain",
                        messageBody: "Not found",
                        statusCode: "404"
                    }
                }],
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: httpsListenerName })
        }, { parent: alb });
        const result = {};
        this._config.targets.forEach((target, index) => {
            const targetGroupName = `${this._name}-tgt-grp-${index}`;
            const targetGroup = alb.createTargetGroup(targetGroupName, {
                protocol: "HTTP",
                port: 80,
                targetType: "ip",
                slowStart: target.slowStart,
                deregistrationDelay: 60,
                healthCheck: {
                    path: target.healthCheckPath
                },
                tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: targetGroupName })
            });
            const listenerRuleName = `${this._name}-lnr-rle-${index}`;
            new lb_2.ListenerRule(listenerRuleName, {
                listenerArn: httpsListener.arn,
                priority: this._config.targets.length - index,
                actions: [{
                        type: "forward",
                        targetGroupArn: targetGroup.targetGroup.arn
                    }],
                conditions: [{
                        hostHeader: {
                            values: [target.host]
                        }
                    }],
                tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: listenerRuleName })
            });
            result[target.host] = {
                albTargetGroupArn: targetGroup.targetGroup.arn
            };
        });
        if (this._config.enableWaf)
            this._provisionWaf(alb);
        if (this._config.enableCloudfront)
            this._provisionCloudFrontDistro(alb);
        return result;
    }
    _provisionWaf(alb) {
        (0, n_defensive_1.given)(alb, "alb").ensureHasValue().ensureIsObject();
        const webAclName = `${this._name}-web-acl`;
        const webAcl = new wafv2_1.WebAcl(webAclName, {
            defaultAction: {
                allow: {}
            },
            description: `${this._name} Web ACL`,
            rules: [{
                    name: "app-web-acl-managed-common-rule-set",
                    overrideAction: {
                        none: {}
                    },
                    priority: 1,
                    statement: {
                        managedRuleGroupStatement: {
                            name: "AWSManagedRulesCommonRuleSet",
                            vendorName: "AWS"
                        }
                    },
                    visibilityConfig: {
                        cloudwatchMetricsEnabled: true,
                        metricName: "app-web-acl-managed-common-rule-set-metric",
                        sampledRequestsEnabled: true
                    }
                }],
            scope: "REGIONAL",
            visibilityConfig: {
                cloudwatchMetricsEnabled: true,
                metricName: "app-web-acl-metric",
                sampledRequestsEnabled: true
            },
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: webAclName })
        }, {
            // FIXME: this is a workaround for https://github.com/pulumi/pulumi-aws/issues/1423
            // Be cognizant of this when updating the rules
            ignoreChanges: ["rules"]
        });
        new wafv2_1.WebAclAssociation(`${this._name}-web-acl-asc`, {
            resourceArn: alb.loadBalancer.arn,
            webAclArn: webAcl.arn
        });
    }
    _provisionCloudFrontDistro(alb) {
        (0, n_defensive_1.given)(alb, "alb").ensureHasValue().ensureIsObject();
        const distroName = `${this._name}-cf-distro`;
        new cloudfront_1.Distribution(distroName, {
            origins: [{
                    originId: alb.loadBalancer.dnsName,
                    domainName: alb.loadBalancer.dnsName,
                    customOriginConfig: {
                        originProtocolPolicy: "https-only",
                        httpPort: 80,
                        httpsPort: 443,
                        originSslProtocols: ["TLSv1", "TLSv1.1", "TLSv1.2"]
                    }
                }],
            defaultCacheBehavior: {
                targetOriginId: alb.loadBalancer.dnsName,
                cachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6",
                compress: true,
                allowedMethods: [
                    "DELETE",
                    "GET",
                    "HEAD",
                    "OPTIONS",
                    "PATCH",
                    "POST",
                    "PUT"
                ],
                cachedMethods: [
                    "GET",
                    "HEAD",
                    "OPTIONS"
                ],
                viewerProtocolPolicy: "redirect-to-https"
            },
            enabled: true,
            priceClass: "PriceClass_All",
            restrictions: {
                geoRestriction: {
                    restrictionType: "none"
                }
            },
            viewerCertificate: {
                cloudfrontDefaultCertificate: true
            },
            httpVersion: "http2",
            isIpv6Enabled: true,
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: distroName })
        });
    }
}
exports.AlbProvisioner = AlbProvisioner;
//# sourceMappingURL=alb-provisioner.js.map