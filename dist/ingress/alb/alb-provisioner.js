import { given } from "@nivinjoseph/n-defensive";
import { NfraConfig } from "../../common/nfra-config.js";
// import { Listener, ListenerRule } from "@pulumi/aws/lb";
import * as aws from "@pulumi/aws";
// import { WebAcl, WebAclAssociation } from "@pulumi/aws/wafv2";
// import { Distribution } from "@pulumi/aws/cloudfront";
export class AlbProvisioner {
    // ALB health check defaults. The ALB check gates routing as well as ECS task replacement, so it stays an order of
    // magnitude tighter than the container probe (~100s to deregister, ~40s to re-admit) rather than liveness-grade.
    static _healthCheckTimeoutSeconds = 10; // ALB range 2-120; clamped to 5-60 here as before
    static _healthCheckUnhealthyThreshold = 5; // ALB range 2-10
    static _healthCheckHealthyThreshold = 2; // ALB range 2-10
    // Listener rule priorities. Rejecting rules count down from 999 (`<name>-br-lrl`); the default host's path rule is
    // 1000 and host rules start at 1001. The values are explicit because the provider otherwise assigns highest-existing
    // + 1, so a listener's priorities are bounded by the most rules it ever held at once: stacks deployed before the block
    // rule existed hold such values on their forward rules until renumbered, and a rule deleted in the same `pulumi up`
    // keeps its priority until after every create (Pulumi deletes last). Hence: no value a long-lived stack could have reached
    // (999/1000 leaves headroom no realistic stack exhausts), and the path rule and the host rules never share a slot
    // (switching a stack between the two modes deletes one kind and creates the other).
    static _blockRulePriority = 999;
    static _defaultPathRulePriority = 1000;
    static _hostRulePriorityBase = 1001;
    // TLS 1.2 and 1.3 only (AWS's recommended ALB policy). Changing it is an in-place listener update.
    static _sslPolicy = "ELBSecurityPolicy-TLS13-1-2-2021-06";
    // Default action of the main listener when no rule matches; a default host without a path pattern forwards instead.
    static _notFoundAction = {
        type: "fixed-response",
        fixedResponse: {
            contentType: "text/plain",
            messageBody: "Not found",
            statusCode: "404"
        }
    };
    _name;
    _config;
    _useTls;
    _onlyDefault;
    _defaultPathPattern;
    constructor(name, config) {
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name.trim();
        given(config, "config").ensureHasValue().ensureIsObject()
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
                    healthCheckPath: "string",
                    "healthCheckTimeout?": "number",
                    "healthCheckUnhealthyThreshold?": "number",
                    "healthCheckHealthyThreshold?": "number",
                    "slowStart?": "number",
                    "defaultAppPortOverride?": "number",
                    "pathPattern?": "string"
                }]
        })
            .ensure(t => t.targets.isNotEmpty, "at least 1 target must be provided")
            .ensure(t => t.targets.distinct(u => u.host).length === t.targets.length, "target hosts must be distinct")
            .ensureWhen(config.targets.some(u => u.host.trim().toLowerCase() === "default"), t => t.targets.length === 1, "default target can be the only target")
            .ensure(t => t.targets.where(u => u.pathPattern != null).every(u => u.host === "default"), "path patten is only supported for default hosts at the moment");
        const { targets } = config;
        targets.forEach(target => {
            given(target, "target")
                .ensureWhen(target.slowStart != null, t => t.slowStart >= 30 && t.slowStart <= 900, "slowStart value has to be between 30 and 900 inclusive")
                .ensureWhen(target.healthCheckUnhealthyThreshold != null, t => t.healthCheckUnhealthyThreshold >= 2 && t.healthCheckUnhealthyThreshold <= 10, "healthCheckUnhealthyThreshold has to be between 2 and 10 inclusive")
                .ensureWhen(target.healthCheckHealthyThreshold != null, t => t.healthCheckHealthyThreshold >= 2 && t.healthCheckHealthyThreshold <= 10, "healthCheckHealthyThreshold has to be between 2 and 10 inclusive")
                .ensure(t => t.host.length <= 128, "host length cannot be over 128 characters");
            target.host = target.host.trim().toLowerCase();
        });
        config.enableWaf ??= false;
        config.enableWafCloudWatchMetrics ??= false;
        config.enableCloudfront ??= false;
        config.justAlb ??= false;
        this._config = config;
        this._useTls = this._config.certificateArn != null;
        this._onlyDefault = this._config.targets.some(t => t.host === "default");
        const defaultPathPattern = this._onlyDefault ? this._config.targets
            .find(t => t.host === "default").pathPattern?.trim() : null;
        given(defaultPathPattern, "defaultPathPattern").ensureIsString()
            .ensure(t => t.trim().startsWith("/"), "must start with /");
        this._defaultPathPattern = defaultPathPattern?.isNotEmptyOrWhiteSpace() ? defaultPathPattern : null;
    }
    provision() {
        const egressPorts = this._config.targets
            .map(t => t.defaultAppPortOverride ?? 80)
            .distinct();
        const ingressCidrBlocks = this._config.ingressSubnetNamePrefixes == null
            ? ["0.0.0.0/0"]
            : this._config.vpcDetails
                .resolveSubnets(this._config.ingressSubnetNamePrefixes)
                .map(u => u.cidrBlock);
        // .apply(subnets => subnets.map(u => u.cidrBlock));
        const egressCidrBlocks = this._config.vpcDetails
            .resolveSubnets(this._config.egressSubnetNamePrefixes)
            .map(u => u.cidrBlock);
        // .apply(subnets => subnets.map(u => u.cidrBlock));
        const albSecGroupName = `${this._name}-alb-sg1`;
        const appAlbSecGroup = new aws.ec2.SecurityGroup(albSecGroupName, {
            vpcId: this._config.vpcDetails.vpc.id,
            revokeRulesOnDelete: true,
            ingress: [
                {
                    protocol: "tcp",
                    fromPort: 80,
                    toPort: 80,
                    cidrBlocks: ingressCidrBlocks
                },
                this._useTls ? {
                    protocol: "tcp",
                    fromPort: 443,
                    toPort: 443,
                    cidrBlocks: ingressCidrBlocks
                } : null
            ].where(t => t != null),
            egress: egressPorts.map(t => ({
                protocol: "tcp",
                fromPort: t,
                toPort: t,
                cidrBlocks: egressCidrBlocks
            })),
            // egress: [{cidrBlocks: }],
            tags: {
                ...NfraConfig.tags,
                Name: albSecGroupName
            }
        }, {
        // replaceOnChanges: ["*"]
        });
        const albSubnets = this._config.vpcDetails
            .resolveSubnets([this._config.subnetNamePrefix]);
        const albName = `${this._name}-alb`;
        const alb = new aws.lb.LoadBalancer(albName, {
            internal: this._config.isPrivate,
            // internal: false,
            ipAddressType: "ipv4",
            // vpc: this._config.vpcDetails.vpc,
            loadBalancerType: "application",
            subnets: albSubnets
                .map(t => t.id),
            // .apply(subnets => subnets.map(t => t.id)),
            idleTimeout: 4000,
            securityGroups: [appAlbSecGroup.id],
            tags: {
                ...NfraConfig.tags,
                Name: albName,
                ...this._config.tags ?? {}
            }
        });
        const result = {
            dnsName: alb.dnsName,
            hostTargets: {}
        };
        if (this._config.justAlb)
            return result;
        if (this._useTls) {
            const httpListenerName = `${this._name}-ht-lnr`;
            new aws.lb.Listener(httpListenerName, {
                loadBalancerArn: alb.arn,
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
                tags: {
                    ...NfraConfig.tags,
                    Name: httpListenerName
                }
            }, {
                parent: alb
            });
        }
        let listener;
        if (this._onlyDefault) {
            const defaultTargetGroupName = `${this._name}-tg-d`;
            const defaultTargetGroup = new aws.lb.TargetGroup(defaultTargetGroupName, {
                protocol: "HTTP",
                port: this._config.targets[0].defaultAppPortOverride ?? 80,
                targetType: "ip",
                vpcId: this._config.vpcDetails.vpc.id,
                slowStart: this._config.targets[0].slowStart,
                deregistrationDelay: 60,
                stickiness: {
                    enabled: true,
                    type: "lb_cookie",
                    cookieDuration: 604800
                },
                healthCheck: this._createTargetGroupHealthCheck(this._config.targets[0]),
                tags: {
                    ...NfraConfig.tags,
                    Name: defaultTargetGroupName
                }
            });
            // const defaultTargetGroupArn = defaultTargetGroup.arn;
            result.hostTargets[this._config.targets[0].host] = {
                albTargetGroupArn: defaultTargetGroup.arn
            };
            listener = this._provisionListener(alb, this._defaultPathPattern == null
                ? { type: "forward", targetGroupArn: defaultTargetGroup.arn }
                : AlbProvisioner._notFoundAction);
            if (this._defaultPathPattern != null) {
                const listenerRuleName = `${this._name}-dp-lrl`;
                new aws.lb.ListenerRule(listenerRuleName, {
                    listenerArn: listener.arn,
                    priority: AlbProvisioner._defaultPathRulePriority,
                    actions: [{
                            type: "forward",
                            targetGroupArn: defaultTargetGroup.arn
                        }],
                    conditions: [{
                            pathPattern: {
                                values: [this._defaultPathPattern]
                            }
                        }],
                    tags: {
                        ...NfraConfig.tags,
                        Name: listenerRuleName
                    }
                }, {
                    dependsOn: [listener, defaultTargetGroup]
                });
            }
        }
        else {
            listener = this._provisionListener(alb, AlbProvisioner._notFoundAction);
            this._config.targets.forEach((target, index) => {
                const targetGroupName = `${this._name}-tg-${index}`;
                const targetGroup = new aws.lb.TargetGroup(targetGroupName, {
                    protocol: "HTTP",
                    port: target.defaultAppPortOverride ?? 80,
                    targetType: "ip",
                    vpcId: this._config.vpcDetails.vpc.id,
                    slowStart: target.slowStart,
                    deregistrationDelay: 60,
                    stickiness: {
                        enabled: true,
                        type: "lb_cookie",
                        cookieDuration: 604800
                    },
                    healthCheck: this._createTargetGroupHealthCheck(target),
                    tags: {
                        ...NfraConfig.tags,
                        Name: targetGroupName
                    }
                });
                const listenerRuleName = `${this._name}-lrl-${index}`;
                new aws.lb.ListenerRule(listenerRuleName, {
                    listenerArn: listener.arn,
                    priority: AlbProvisioner._hostRulePriorityBase + index,
                    actions: [{
                            type: "forward",
                            targetGroupArn: targetGroup.arn
                        }],
                    conditions: [{
                            hostHeader: {
                                values: [target.host]
                            }
                        }],
                    tags: {
                        ...NfraConfig.tags,
                        Name: listenerRuleName
                    }
                }, {
                    dependsOn: [listener, targetGroup]
                });
                result.hostTargets[target.host] = {
                    albTargetGroupArn: targetGroup.arn
                };
            });
        }
        this._provisionBrotliBlockRule(listener);
        if (this._config.enableWaf)
            this._provisionWaf(alb);
        if (this._config.enableCloudfront)
            this._provisionCloudFrontDistro(alb);
        return result;
    }
    _provisionWaf(alb) {
        given(alb, "alb").ensureHasValue().ensureIsObject();
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
            tags: {
                ...NfraConfig.tags,
                Name: webAclName
            }
        }, {
            // FIXME: this is a workaround for https://github.com/pulumi/pulumi-aws/issues/1423
            // Be cognizant of this when updating the rules
            ignoreChanges: ["rules"]
        });
        new aws.wafv2.WebAclAssociation(`${this._name}-web-acl-asc`, {
            resourceArn: alb.arn,
            webAclArn: webAcl.arn
        });
    }
    _provisionCloudFrontDistro(alb) {
        given(alb, "alb").ensureHasValue().ensureIsObject();
        const distroName = `${this._name}-cf-distro`;
        new aws.cloudfront.Distribution(distroName, {
            origins: [{
                    originId: alb.dnsName,
                    domainName: alb.dnsName,
                    customOriginConfig: {
                        originProtocolPolicy: "https-only",
                        httpPort: 80,
                        httpsPort: 443,
                        // the listener policy refuses anything older; CloudFront has no TLS 1.3 origin option
                        originSslProtocols: ["TLSv1.2"]
                    }
                }],
            defaultCacheBehavior: {
                targetOriginId: alb.dnsName,
                cachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6", // "Managed-CachingOptimized"
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
                    targetOriginId: alb.dnsName,
                    cachePolicyId: "4135ea2d-6df8-44a3-9df3-4b5a84be39ad", // "Managed-CachingDisabled"
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
            tags: {
                ...NfraConfig.tags,
                Name: distroName
            }
        });
    }
    _provisionListener(alb, defaultAction) {
        given(alb, "alb").ensureHasValue().ensureIsObject();
        given(defaultAction, "defaultAction").ensureHasValue().ensureIsObject();
        const listenerName = `${this._name}-ht${this._useTls ? "s" : ""}-lnr`;
        return new aws.lb.Listener(listenerName, {
            loadBalancerArn: alb.arn,
            protocol: this._useTls ? "HTTPS" : "HTTP",
            port: this._useTls ? 443 : 80,
            certificateArn: this._useTls ? this._config.certificateArn : undefined,
            sslPolicy: this._useTls ? AlbProvisioner._sslPolicy : undefined,
            defaultActions: [defaultAction],
            tags: {
                ...NfraConfig.tags,
                Name: listenerName
            }
        }, {
            parent: alb
        });
    }
    _provisionBrotliBlockRule(listener) {
        given(listener, "listener").ensureHasValue().ensureIsObject();
        // CVE-2026-111497: a crafted Brotli request body reaches the Node.js Brotli decoder through body parsers that
        // inflate `Content-Encoding: br` by default. Reject such requests at the edge, ahead of every forward rule.
        // Header matching is case-insensitive and `*br*` also catches `gzip, br`. The listener is an implicit dependency
        // through `listenerArn`; no ordering against the forward rules is needed, because nothing can hold priority 999
        // before they are renumbered (see the priority constants), and a consumer rule parked there is not moved by Pulumi.
        const ruleName = `${this._name}-br-lrl`;
        new aws.lb.ListenerRule(ruleName, {
            listenerArn: listener.arn,
            priority: AlbProvisioner._blockRulePriority,
            actions: [{
                    type: "fixed-response",
                    fixedResponse: {
                        contentType: "text/plain",
                        messageBody: "Unsupported Content-Encoding",
                        statusCode: "415"
                    }
                }],
            conditions: [{
                    httpHeader: {
                        httpHeaderName: "Content-Encoding",
                        values: ["*br*"]
                    }
                }],
            tags: {
                ...NfraConfig.tags,
                Name: ruleName
            }
        });
    }
    _createTargetGroupHealthCheck(target) {
        const timeout = Math.min(Math.max(target.healthCheckTimeout ?? AlbProvisioner._healthCheckTimeoutSeconds, 5), 60);
        return {
            path: target.healthCheckPath,
            timeout,
            interval: timeout * 2, // ALB requires timeout < interval
            unhealthyThreshold: target.healthCheckUnhealthyThreshold ?? AlbProvisioner._healthCheckUnhealthyThreshold,
            healthyThreshold: target.healthCheckHealthyThreshold ?? AlbProvisioner._healthCheckHealthyThreshold
        };
    }
}
//# sourceMappingURL=alb-provisioner.js.map