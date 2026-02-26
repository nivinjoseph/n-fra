import { given } from "@nivinjoseph/n-defensive";
import { EfsDetails } from "./efs-details.js";
import * as aws from "@pulumi/aws";
import { NfraConfig } from "../../common/nfra-config.js";
export class EfsProvisioner {
    constructor(name, config) {
        // this._name = CommonHelper.prefixName(name);
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
        given(config, "config").ensureHasValue().ensureIsObject().ensureHasStructure({
            vpcDetails: "object",
            subnetNamePrefix: "string",
            ingressSubnetNamePrefixes: ["string"],
            "useMaxIoPerformanceMode?": "boolean"
        });
        this._config = config;
    }
    provision() {
        const efsSubnets = this._config.vpcDetails
            .resolveSubnets([this._config.subnetNamePrefix]);
        const fileSystemName = `${this._name}-efs`;
        const fileSystem = new aws.efs.FileSystem(fileSystemName, {
            performanceMode: this._config.useMaxIoPerformanceMode ? "maxIO" : "generalPurpose",
            encrypted: true,
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: fileSystemName })
        });
        const ingressCidrBlocks = this._config.vpcDetails
            .resolveSubnets(this._config.ingressSubnetNamePrefixes)
            .map(u => u.cidrBlock);
        const securityGroupName = `${this._name}-efs-sg`;
        const fileSystemSecGroup = new aws.ec2.SecurityGroup(securityGroupName, {
            vpcId: this._config.vpcDetails.vpc.id,
            revokeRulesOnDelete: true,
            ingress: [
                {
                    protocol: "tcp",
                    fromPort: 2049,
                    toPort: 2049,
                    cidrBlocks: ingressCidrBlocks
                }
            ],
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: securityGroupName })
        });
        const _mountTargets = efsSubnets.map((subnet, index) => {
            const mountTargetName = `${this._name}-efs-mt${index}`;
            const mountTarget = new aws.efs.MountTarget(mountTargetName, {
                fileSystemId: fileSystem.id,
                subnetId: subnet.id,
                securityGroups: [fileSystemSecGroup.id]
            });
            return mountTarget;
        });
        // const defaultPolicyDoc = aws.iam.getPolicyDocumentOutput({
        //     statements: [{
        //         effect: "Deny",
        //         actions: [
        //             "elasticfilesystem:*"
        //         ],
        //         resources: [fileSystem.arn],
        //         conditions: [{
        //             test: "Bool",
        //             variable: "aws:SecureTransport",
        //             values: ["false"]
        //         }]
        //     }]
        // });
        // const defaultPolicyName = `${this._name}-efs-default-pol`;
        // const _defaultPolicy = new aws.efs.FileSystemPolicy(defaultPolicyName, {
        //     fileSystemId: fileSystem.id,
        //     policy: defaultPolicyDoc.apply(t => t.json),
        //     bypassPolicyLockoutSafetyCheck: false
        // });
        return new EfsDetails(this._name, fileSystem.id, fileSystem.arn);
    }
}
//# sourceMappingURL=efs-provisioner.js.map