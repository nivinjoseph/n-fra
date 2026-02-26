import { given } from "@nivinjoseph/n-defensive";
// import * as awsx from "@pulumi/awsx";
import type { AlbConfig } from "./alb-config.js";
import type { AlbDetails } from "./alb-details.js";
import { NfraConfig } from "../../common/nfra-config.js";
// import { Listener, ListenerRule } from "@pulumi/aws/lb";
import * as aws from "@pulumi/aws";
// import { WebAcl, WebAclAssociation } from "@pulumi/aws/wafv2";
// import { Distribution } from "@pulumi/aws/cloudfront";


export class AlbProvisioner
{
    private readonly _name: string;
    private readonly _config: AlbConfig;
    private readonly _useTls: boolean;
    private readonly _onlyDefault: boolean;
    private readonly _defaultPathPattern: string | null;


    public constructor(name: string, config: AlbConfig)
    {
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
                    "slowStart?": "number",
                    "defaultAppPortOverride?": "number",
                    "pathPattern?": "string"
                }]
            })
            .ensure(t => t.targets.isNotEmpty, "at least 1 target must be provided")
            .ensure(t => t.targets.distinct(u => u.host).length === t.targets.length, "target hosts must be distinct")
            .ensureWhen(config.targets.some(u => u.host.trim().toLowerCase() === "default"), t => t.targets.length === 1, "default target can be the only target")
            .ensure(t => t.targets.where(u => u.pathPattern != null).every(u => u.host === "default"), "path patten is only supported for default hosts at the moment")
            ;

        const { targets } = config;
        targets.forEach(target =>
        {
            given(target, "target")
                .ensure(t => t.slowStart == null || (t.slowStart >= 30 && t.slowStart <= 900),
                    "slowStart value has to be between 30 and 900 inclusive")
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
            .find(t => t.host === "default")!.pathPattern?.trim() : null;
        given(defaultPathPattern, "defaultPathPattern").ensureIsString()
            .ensure(t => t.trim().startsWith("/"), "must start with /");
        this._defaultPathPattern = defaultPathPattern?.isNotEmptyOrWhiteSpace() ? defaultPathPattern : null;
    }


    public provision(): AlbDetails
    {
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
            ].where(t => t != null) as Array<aws.types.input.ec2.SecurityGroupIngress>,
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

        const result: AlbDetails = {
            dnsName: alb.dnsName,
            hostTargets: {}
        };

        if (this._config.justAlb)
            return result;

        if (this._useTls)
        {
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

        if (this._onlyDefault)
        {
            const defaultTargetGroupName = `${this._name}-tg-d`;
            const healthCheckTimeout = Math.min(Math.max(this._config.targets[0].healthCheckTimeout ?? 5, 5), 60);
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
                healthCheck: {
                    path: this._config.targets[0].healthCheckPath,
                    timeout: healthCheckTimeout,
                    interval: healthCheckTimeout * 2
                },
                tags: {
                    ...NfraConfig.tags,
                    Name: defaultTargetGroupName
                }
            });
            
            // const defaultTargetGroupArn = defaultTargetGroup.arn;

            result.hostTargets[this._config.targets[0].host] = {
                albTargetGroupArn: defaultTargetGroup.arn
            };

            const listenerName = `${this._name}-ht${this._useTls ? "s" : ""}-lnr`;
            const listener = new aws.lb.Listener(listenerName, {
                loadBalancerArn: alb.arn,
                protocol: this._useTls ? "HTTPS" : "HTTP",
                port: this._useTls ? 443 : 80,
                certificateArn: this._useTls ? this._config.certificateArn! : undefined,
                // https://aws.amazon.com/about-aws/whats-new/2017/02/elastic-load-balancing-support-for-tls-1-1-and-tls-1-2-pre-defined-security-policies/
                sslPolicy: this._useTls ? "ELBSecurityPolicy-2016-08" : undefined,
                // sslPolicy: "ELBSecurityPolicy-TLS-1-2-2017-01",
                defaultActions: [this._defaultPathPattern == null
                    ? {
                        type: "forward",
                        targetGroupArn: defaultTargetGroup.arn
                    }
                    : {
                        type: "fixed-response",
                        fixedResponse: {
                            contentType: "text/plain",
                            messageBody: "Not found",
                            statusCode: "404"
                        }
                    }],
                tags: {
                    ...NfraConfig.tags,
                    Name: listenerName
                }
            }, {
                parent: alb
            });

            if (this._defaultPathPattern != null)
            {
                const listenerRuleName = `${this._name}-dp-lrl`;
                new aws.lb.ListenerRule(listenerRuleName, {
                    listenerArn: listener.arn,
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
        else
        {
            const listenerName = `${this._name}-ht${this._useTls ? "s" : ""}-lnr`;
            const listener = new aws.lb.Listener(listenerName, {
                loadBalancerArn: alb.arn,
                protocol: this._useTls ? "HTTPS" : "HTTP",
                port: this._useTls ? 443 : 80,
                certificateArn: this._useTls ? this._config.certificateArn! : undefined,
                // https://aws.amazon.com/about-aws/whats-new/2017/02/elastic-load-balancing-support-for-tls-1-1-and-tls-1-2-pre-defined-security-policies/
                sslPolicy: this._useTls ? "ELBSecurityPolicy-2016-08" : undefined,
                // sslPolicy: "ELBSecurityPolicy-TLS-1-2-2017-01",
                defaultActions: [{
                    type: "fixed-response",
                    fixedResponse: {
                        contentType: "text/plain",
                        messageBody: "Not found",
                        statusCode: "404"
                    }
                }],
                tags: {
                    ...NfraConfig.tags,
                    Name: listenerName
                }
            }, {
                parent: alb
            });

            this._config.targets.forEach((target, index) =>
            {
                const targetGroupName = `${this._name}-tg-${index}`;
                const healthCheckTimeout = Math.min(Math.max(target.healthCheckTimeout ?? 5, 5), 60);
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
                    healthCheck: {
                        path: target.healthCheckPath,
                        timeout: healthCheckTimeout,
                        interval: healthCheckTimeout * 2
                        // unhealthyThreshold: 10 // // FIXME: make this configurable,
                    },
                    tags: {
                        ...NfraConfig.tags,
                        Name: targetGroupName
                    }
                });

                const listenerRuleName = `${this._name}-lrl-${index}`;
                new aws.lb.ListenerRule(listenerRuleName, {
                    listenerArn: listener.arn,
                    // priority: this._config.targets.length - index,
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

        if (this._config.enableWaf)
            this._provisionWaf(alb);

        if (this._config.enableCloudfront)
            this._provisionCloudFrontDistro(alb);

        return result;
    }

    private _provisionWaf(alb: aws.lb.LoadBalancer): void
    {
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
                    cloudwatchMetricsEnabled: this._config.enableWafCloudWatchMetrics!,
                    metricName: "app-web-acl-managed-common-rule-set-metric",
                    sampledRequestsEnabled: true
                }
            }],
            scope: "REGIONAL",
            visibilityConfig: {
                cloudwatchMetricsEnabled: this._config.enableWafCloudWatchMetrics!,
                metricName: "app-web-acl-metric",
                sampledRequestsEnabled: true
            },
            tags: {
                ...NfraConfig.tags,
                Name: webAclName
            }
        },
            {
                // FIXME: this is a workaround for https://github.com/pulumi/pulumi-aws/issues/1423
                // Be cognizant of this when updating the rules
                ignoreChanges: ["rules"]
            }
        );

        new aws.wafv2.WebAclAssociation(`${this._name}-web-acl-asc`, {
            resourceArn: alb.arn,
            webAclArn: webAcl.arn
        });
    }

    private _provisionCloudFrontDistro(alb: aws.lb.LoadBalancer): void
    {
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
                    originSslProtocols: ["TLSv1", "TLSv1.1", "TLSv1.2"]
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
}