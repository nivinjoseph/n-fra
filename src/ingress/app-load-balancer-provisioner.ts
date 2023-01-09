import { given } from "@nivinjoseph/n-defensive";
import { SecurityGroup } from "@pulumi/awsx/ec2";
import { VpcDetails } from "../vpc/vpc-details";
import { AppLoadBalancerConfig } from "./app-load-balancer-config";
import { AppLoadBalancerDetails } from "./app-load-balancer-details";
import * as Pulumi from "@pulumi/pulumi";
import { InfraConfig } from "../infra-config";
import { ApplicationLoadBalancer } from "@pulumi/awsx/lb";
import { Listener, ListenerRule } from "@pulumi/aws/lb";
import { WebAcl, WebAclAssociation } from "@pulumi/aws/wafv2";
import { Distribution } from "@pulumi/aws/cloudfront";


export class AppLoadBalancerProvisioner
{
    private readonly _name: string;
    private readonly _vpcDetails: VpcDetails;
    private readonly _config: AppLoadBalancerConfig;
    
    
    public constructor(name: string, vpcDetails: VpcDetails, config: AppLoadBalancerConfig)
    {
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
        
        given(vpcDetails, "vpcDetails").ensureHasValue().ensureIsObject();
        this._vpcDetails = vpcDetails;
        
        given(config, "config").ensureHasValue().ensureIsObject().ensureHasStructure({
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
        this._config = config;
    }
    
    
    public provision(): AppLoadBalancerDetails
    {
        const albSecGroupName = `${this._name}-sg`;
        const appAlbSecGroup = new SecurityGroup(albSecGroupName, {
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
                ...InfraConfig.tags,
                Name: albSecGroupName
            }
        });

        const albName = `${this._name}-alb`;
        const alb = new ApplicationLoadBalancer(albName, {
            external: true,
            ipAddressType: "ipv4",
            vpc: this._vpcDetails.vpc,
            subnets: Pulumi.output(this._vpcDetails.vpc.getSubnets("public"))
                .apply((subnets) => subnets.where(t => t.subnetName.startsWith(this._config.subnetNamePrefix)).map(t => t.id)),
            securityGroups: [appAlbSecGroup],
            tags: { 
                ...InfraConfig.tags,
                Name: albName
            }
        });

        const httpListenerName = `${this._name}-http-lnr`;
        new Listener(httpListenerName, {
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
                ...InfraConfig.tags,
                Name: httpListenerName
            }
        }, { parent: alb });

        const httpsListenerName = `${this._name}-https-lnr`;
        const httpsListener = new Listener(httpsListenerName, {
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
                ...InfraConfig.tags,
                Name: httpsListenerName
            }
        }, { parent: alb });
        
        
        const result: AppLoadBalancerDetails = {};
        
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
                    ...InfraConfig.tags,
                    Name: targetGroupName
                }
            });
            
            const listenerRuleName = `${this._name}-lnr-rle-${index}`;
            new ListenerRule(listenerRuleName, {
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
                    ...InfraConfig.tags,
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
    
    private _provisionWaf(alb: ApplicationLoadBalancer): void
    {
        given(alb, "alb").ensureHasValue().ensureIsObject();

        const webAclName = `${this._name}-web-acl`;
        const webAcl = new WebAcl(webAclName, {
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
                ...InfraConfig.tags,
                Name: webAclName
            }
        },
            {
                // FIXME: this is a workaround for https://github.com/pulumi/pulumi-aws/issues/1423
                // Be cognizant of this when updating the rules
                ignoreChanges: ["rules"]
            }
        );

        new WebAclAssociation(`${this._name}-web-acl-asc`, {
            resourceArn: alb.loadBalancer.arn,
            webAclArn: webAcl.arn
        });
    }

    private _provisionCloudFrontDistro(alb: ApplicationLoadBalancer): void
    {
        given(alb, "alb").ensureHasValue().ensureIsObject();

        const distroName = `${this._name}-cf-distro`;
        new Distribution(distroName, {
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
                ...InfraConfig.tags,
                Name: distroName
            }
        });
    }
}