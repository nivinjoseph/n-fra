"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlbProvisioner = void 0;
const n_defensive_1 = require("@nivinjoseph/n-defensive");
// import { SecurityGroup } from "@pulumi/awsx/ec2";
const awsx = require("@pulumi/awsx");
const Pulumi = require("@pulumi/pulumi");
const nfra_config_1 = require("../nfra-config");
// import { ApplicationLoadBalancer } from "@pulumi/awsx/lb";
// import { Listener, ListenerRule } from "@pulumi/aws/lb";
const aws = require("@pulumi/aws");
// import { WebAcl, WebAclAssociation } from "@pulumi/aws/wafv2";
// import { Distribution } from "@pulumi/aws/cloudfront";
class AlbProvisioner {
    constructor(name, config) {
        var _a, _b, _c, _d;
        (0, n_defensive_1.given)(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
        (0, n_defensive_1.given)(config, "config").ensureHasValue().ensureIsObject()
            .ensureHasStructure({
            vpcDetails: "object",
            subnetNamePrefix: "string",
            egressSubnetNamePrefixes: ["string"],
            "certificateArn?": "string",
            "enableWaf?": "boolean",
            "enableWafCloudWatchMetrics?": "boolean",
            "enableCloudfront?": "boolean",
            targets: [{
                    host: "string",
                    "slowStart?": "number",
                    "healthCheckPath": "string"
                }]
        })
            .ensure(t => t.targets.isNotEmpty, "at least 1 target must be provided")
            .ensure(t => t.targets.distinct(u => u.host).length === t.targets.length, "target hosts must be distinct")
            .ensureWhen(config.targets.some(u => u.host.trim().toLowerCase() === "default"), t => t.targets.length === 1, "default target can be the only target");
        const { targets } = config;
        targets.forEach(target => {
            (0, n_defensive_1.given)(target, "target")
                .ensure(t => t.slowStart == null || (t.slowStart >= 30 && t.slowStart <= 900), "slowStart value has to be between 30 and 900 inclusive")
                .ensure(t => t.host.length <= 128, "host length cannot be over 128 characters");
            target.host = target.host.trim().toLowerCase();
        });
        (_a = config.enableWaf) !== null && _a !== void 0 ? _a : (config.enableWaf = false);
        (_b = config.enableWafCloudWatchMetrics) !== null && _b !== void 0 ? _b : (config.enableWafCloudWatchMetrics = false);
        (_c = config.enableCloudfront) !== null && _c !== void 0 ? _c : (config.enableCloudfront = false);
        (_d = config.justAlb) !== null && _d !== void 0 ? _d : (config.justAlb = false);
        this._config = config;
        this._useTls = this._config.certificateArn != null;
        this._onlyDefault = this._config.targets.some(t => t.host === "default");
    }
    provision() {
        const albSecGroupName = `${this._name}-sg`;
        const appAlbSecGroup = new awsx.ec2.SecurityGroup(albSecGroupName, {
            vpc: this._config.vpcDetails.vpc,
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
                    cidrBlocks: Pulumi.output(this._config.vpcDetails.vpc.getSubnets("private"))
                        .apply((subnets) => subnets.where(subnet => this._config.egressSubnetNamePrefixes.some(prefix => subnet.subnetName.startsWith(prefix)))
                        .map(t => t.subnet.cidrBlock))
                }],
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: albSecGroupName })
        });
        const albName = `${this._name}-alb`;
        const alb = new awsx.lb.ApplicationLoadBalancer(albName, {
            external: true,
            ipAddressType: "ipv4",
            vpc: this._config.vpcDetails.vpc,
            subnets: Pulumi.output(this._config.vpcDetails.vpc.getSubnets("public"))
                .apply((subnets) => subnets.where(t => t.subnetName.startsWith(this._config.subnetNamePrefix)).map(t => t.id)),
            securityGroups: [appAlbSecGroup],
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: albName })
        });
        const result = {
            dnsName: alb.loadBalancer.dnsName,
            hostTargets: {}
        };
        if (this._config.justAlb)
            return result;
        let defaultTargetGroupArn = null;
        if (this._onlyDefault) {
            const defaultTargetGroupName = `${this._name}-tgt-grp-d`;
            const defaultTargetGroup = alb.createTargetGroup(defaultTargetGroupName, {
                protocol: "HTTP",
                port: 80,
                targetType: "ip",
                slowStart: this._config.targets[0].slowStart,
                deregistrationDelay: 60,
                healthCheck: {
                    path: this._config.targets[0].healthCheckPath
                },
                tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: defaultTargetGroupName })
            });
            defaultTargetGroupArn = defaultTargetGroup.targetGroup.arn;
            result.hostTargets[this._config.targets[0].host] = {
                albTargetGroupArn: defaultTargetGroupArn
            };
        }
        let listenerArn;
        if (this._useTls) {
            const httpListenerName = `${this._name}-http-lnr`;
            new aws.lb.Listener(httpListenerName, {
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
                tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: httpListenerName })
            }, {
                parent: alb
            });
            const httpsListenerName = `${this._name}-https-lnr`;
            const httpsListener = new aws.lb.Listener(httpsListenerName, {
                loadBalancerArn: alb.loadBalancer.arn,
                protocol: "HTTPS",
                port: 443,
                certificateArn: this._config.certificateArn,
                sslPolicy: "ELBSecurityPolicy-2016-08",
                defaultActions: [this._onlyDefault
                        ? {
                            type: "forward",
                            targetGroupArn: defaultTargetGroupArn
                        }
                        : {
                            type: "fixed-response",
                            fixedResponse: {
                                contentType: "text/plain",
                                messageBody: "Not found",
                                statusCode: "404"
                            }
                        }],
                tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: httpsListenerName })
            }, {
                parent: alb
            });
            listenerArn = httpsListener.arn;
        }
        else {
            const httpListenerName = `${this._name}-http-lnr`;
            const httpListener = new aws.lb.Listener(httpListenerName, {
                loadBalancerArn: alb.loadBalancer.arn,
                protocol: "HTTP",
                port: 80,
                defaultActions: [this._onlyDefault
                        ? {
                            type: "forward",
                            targetGroupArn: defaultTargetGroupArn
                        }
                        : {
                            type: "fixed-response",
                            fixedResponse: {
                                contentType: "text/plain",
                                messageBody: "Not found",
                                statusCode: "404"
                            }
                        }],
                tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: httpListenerName })
            }, {
                parent: alb
            });
            listenerArn = httpListener.arn;
        }
        if (!this._onlyDefault) {
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
                    tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: targetGroupName })
                });
                const listenerRuleName = `${this._name}-lnr-rle-${index}`;
                new aws.lb.ListenerRule(listenerRuleName, {
                    listenerArn,
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
                    tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: listenerRuleName })
                });
                result.hostTargets[target.host] = {
                    albTargetGroupArn: targetGroup.targetGroup.arn
                };
            });
        }
        if (this._config.enableWaf)
            this._provisionWaf(alb);
        if (this._config.enableCloudfront)
            this._provisionCloudFrontDistro(alb);
        return result;
    }
    _provisionWaf(alb) {
        (0, n_defensive_1.given)(alb, "alb").ensureHasValue().ensureIsObject();
        const webAclName = `${this._name}-web-acl`;
        const webAcl = new aws.wafv2.WebAcl(webAclName, {
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
                        cloudwatchMetricsEnabled: this._config.enableWafCloudWatchMetrics,
                        metricName: "app-web-acl-managed-common-rule-set-metric",
                        sampledRequestsEnabled: true
                    }
                }],
            scope: "REGIONAL",
            visibilityConfig: {
                cloudwatchMetricsEnabled: this._config.enableWafCloudWatchMetrics,
                metricName: "app-web-acl-metric",
                sampledRequestsEnabled: true
            },
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: webAclName })
        }, {
            // FIXME: this is a workaround for https://github.com/pulumi/pulumi-aws/issues/1423
            // Be cognizant of this when updating the rules
            ignoreChanges: ["rules"]
        });
        new aws.wafv2.WebAclAssociation(`${this._name}-web-acl-asc`, {
            resourceArn: alb.loadBalancer.arn,
            webAclArn: webAcl.arn
        });
    }
    _provisionCloudFrontDistro(alb) {
        (0, n_defensive_1.given)(alb, "alb").ensureHasValue().ensureIsObject();
        const distroName = `${this._name}-cf-distro`;
        new aws.cloudfront.Distribution(distroName, {
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
            orderedCacheBehaviors: [{
                    targetOriginId: alb.loadBalancer.dnsName,
                    cachePolicyId: "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
                    pathPattern: "/api/*",
                    // compress: true,
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
                }],
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
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: distroName })
        });
    }
}
exports.AlbProvisioner = AlbProvisioner;
//# sourceMappingURL=alb-provisioner.js.map