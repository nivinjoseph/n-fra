// import { ConfigurationManager } from "@nivinjoseph/n-config";
// import { given } from "@nivinjoseph/n-defensive";
// import * as aws from "@pulumi/aws";
// import { ConfigType, InfraConfig } from "../../helpers/infra-config.js";
// import { SubnetPrefix } from "../../helpers/subnet-prefix.js";
// import { VpcHelper } from "../../helpers/vpc-helper.js";
export {};
// import * as pulumi from "@pulumi/pulumi";
// import { GlobalInit } from "../../helpers/global-init.js";
// export class RabbitCloudAmqpProvisioner
// {
//     private readonly _vpc: awsx.ec2.Vpc;
//     private readonly _config: CloudAmqpConfig;
//     public constructor()
//     {
//         given(vpc, "vpc").ensureHasValue().ensureIsObject();
//         this._vpc = vpc;
//         const rabbitPassword = ConfigurationManager.getConfig<string>("RABBIT_CLOUDAMQP_PASSWORD");
//         given(rabbitPassword, "rabbitPassword").ensureHasValue().ensureIsString();
//         this._config = {
//             cloudamqpVpcEndpointServiceName: InfraConfig.getEnvConfigString("cloudamqp-vpc-endpoint-service-name"),
//             rabbitHost: InfraConfig.getEnvConfigString("cloudamqp-host"),
//             rabbitUsername: InfraConfig.getEnvConfigString("cloudamqp-username"),
//             rabbitPassword
//         };
//     }
//     public async provisionResources(): Promise<void>
//     {
//         const cloudamqpMqSubnets = await VpcHelper.fetchSubnets(this._vpc, {
//             subnetPrefixAliases: [SubnetPrefix.rabbitMq],
//             getActualSubnet: GlobalInit.getAprSubnetAlias
//         });
//         const sgIngressSubnets = await VpcHelper.fetchSubnets(this._vpc, {
//             subnetPrefixAliases: [
//                 SubnetPrefix.rabbitMq,
//                 SubnetPrefix.service,
//                 SubnetPrefix.feedsApi,
//                 SubnetPrefix.reaccomAdmin,
//                 SubnetPrefix.iprApi,
//                 SubnetPrefix.aprCoreSolutionApi,
//                 SubnetPrefix.hotelEligibilityApi,
//                 SubnetPrefix.jumpbox],
//             getActualSubnet: GlobalInit.getAprSubnetAlias
//         });
//         const tags = InfraConfig.tags;
//         const cloudamqpPort = 5672;
//         const cloudamqpSecGroup = new awsx.ec2.SecurityGroup("cloudamqp-sec-group_1", {
//             vpc: this._vpc,
//             ingress: [
//                 {
//                     protocol: "tcp",
//                     fromPort: cloudamqpPort,
//                     toPort: cloudamqpPort,
//                     cidrBlocks: sgIngressSubnets.map(t => t.cidrBlock)
//                 }
//             ],
//             tags
//         });
//         const vpcEndpointName = `${InfraConfig.project}-${InfraConfig.env}-cloudamqp-vpc-endpoint`;
//         new aws.ec2.VpcEndpoint(vpcEndpointName, {
//             vpcId: this._vpc.id,
//             serviceName: this._config.cloudamqpVpcEndpointServiceName,
//             vpcEndpointType: "Interface",
//             securityGroupIds: [cloudamqpSecGroup.id],
//             subnetIds: cloudamqpMqSubnets.map(t => t.id),
//             tags: { Name: vpcEndpointName, ...tags }
//         });
//         InfraConfig.setDynamicConfig(ConfigType.rabbitHost, pulumi.output(this._config.rabbitHost));
//         InfraConfig.setDynamicConfig(ConfigType.rabbitMgmtHost, pulumi.output(this._config.rabbitHost));
//         InfraConfig.setDynamicConfig(ConfigType.rabbitUsername, pulumi.output(this._config.rabbitUsername));
//         InfraConfig.setDynamicConfig(ConfigType.rabbitPassword, pulumi.output(this._config.rabbitPassword));
//         InfraConfig.resolve = InfraConfig.resolve.apply(c =>
//         {
//             c[ConfigType.rabbitHost] = this._config.rabbitHost;
//             c[ConfigType.rabbitMgmtHost] = this._config.rabbitHost;
//             c[ConfigType.rabbitUsername] = this._config.rabbitUsername;
//             c[ConfigType.rabbitPassword] = this._config.rabbitPassword;
//             return c;
//         });
//     }
// }
// interface CloudAmqpConfig
// {
//     cloudamqpVpcEndpointServiceName: string;
//     rabbitHost: string;
//     rabbitUsername: string;
//     rabbitPassword: string;
// }
//# sourceMappingURL=rabbit-cloud-amqp-provisioner.js.map