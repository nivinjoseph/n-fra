import { given } from "@nivinjoseph/n-defensive";
// import { SecurityGroup } from "@pulumi/awsx/ec2";
import * as awsx from "@pulumi/awsx";
import { VpcDetails } from "../vpc/vpc-details";
import { AlbConfig } from "./alb-config";
import { AlbDetails } from "./alb-details";
import * as Pulumi from "@pulumi/pulumi";
import { NfraConfig } from "../nfra-config";
// import { ApplicationLoadBalancer } from "@pulumi/awsx/lb";
// import { Listener, ListenerRule } from "@pulumi/aws/lb";
import * as aws from "@pulumi/aws";
// import { WebAcl, WebAclAssociation } from "@pulumi/aws/wafv2";
// import { Distribution } from "@pulumi/aws/cloudfront";


export class AlbProvisioner
{
    private readonly _name: string;
    private readonly _vpcDetails: VpcDetails;
    private readonly _config: AlbConfig;
    
    
    public constructor(name: string, vpcDetails: VpcDetails, config: AlbConfig)
    {
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
        
        given(vpcDetails, "vpcDetails").ensureHasValue().ensureIsObject();
        this._vpcDetails = vpcDetails;
        
        given(config, "config").ensureHasValue().ensureIsObject()
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
        targets.forEach(target =>
        {
            given(target, "target")
                .ensure(t => t.slowStart == null || (t.slowStart >= 30 && t.slowStart <= 900),
                    "slowStart value has to be between 30 and 900 inclusive")
                .ensure(t => t.host.length <= 128, "host length cannot be over 128 characters");
        });
        
        config.enableWaf ??= false;
        config.enableCloudfront ??= false;
        config.justAlb ??= false;
        this._config = config;
    }
    
    
    public provision(): AlbDetails
    {
        const albSecGroupName = `${this._name}-sg`;
        const appAlbSecGroup = new awsx.ec2.SecurityGroup(albSecGroupName, {
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
                    .apply((subnets) =>
                        subnets.where(subnet =>
                            this._config.egressSubnetNamePrefixes.some(prefix =>
                                subnet.subnetName.startsWith(prefix)))
                            .map(t => t.subnet.cidrBlock as Pulumi.Output<string>))
            }],
            tags: {
                ...NfraConfig.tags,
                Name: albSecGroupName
            }
        });

        const albName = `${this._name}-alb`;
        const alb = new awsx.lb.ApplicationLoadBalancer(albName, {
            external: true,
            ipAddressType: "ipv4",
            vpc: this._vpcDetails.vpc,
            subnets: Pulumi.output(this._vpcDetails.vpc.getSubnets("public"))
                .apply((subnets) => subnets.where(t => t.subnetName.startsWith(this._config.subnetNamePrefix)).map(t => t.id)),
            securityGroups: [appAlbSecGroup],
            tags: { 
                ...NfraConfig.tags,
                Name: albName
            }
        });
        
        if (this._config.justAlb)
            return {};

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
            tags: {
                ...NfraConfig.tags,
                Name: httpListenerName
            }
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
                Name: httpsListenerName
            }
        }, {
            parent: alb
        });
        
        
        const result: AlbDetails = {};
        
        this._config.targets.forEach((target, index) =>
        {
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
                tags: {
                    ...NfraConfig.tags,
                    Name: targetGroupName
                }
            });
            
            const listenerRuleName = `${this._name}-lnr-rle-${index}`;
            new aws.lb.ListenerRule(listenerRuleName, {
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
                tags: {
                    ...NfraConfig.tags,
                    Name: listenerRuleName
                }
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
    
    private _provisionWaf(alb: awsx.lb.ApplicationLoadBalancer): void
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
            resourceArn: alb.loadBalancer.arn,
            webAclArn: webAcl.arn
        });
    }

    private _provisionCloudFrontDistro(alb: awsx.lb.ApplicationLoadBalancer): void
    {
        given(alb, "alb").ensureHasValue().ensureIsObject();

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
                cachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6", // "Managed-CachingOptimized",
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
            tags: {
                ...NfraConfig.tags,
                Name: distroName
            }
        });
    }
}