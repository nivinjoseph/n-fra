import { ensureExhaustiveCheck, given } from "@nivinjoseph/n-defensive";
import * as aws from "@pulumi/aws";
import { NfraConfig } from "../../common/nfra-config.js";
import * as tls from "@pulumi/tls";
export class WindowsBastionProvisioner {
    constructor(name, config) {
        // this._name = CommonHelper.prefixName(name);
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
        given(config, "config").ensureHasValue().ensureIsObject()
            .ensureHasStructure({
            vpcDetails: "object",
            subnetNamePrefix: "string",
            "ingressSubnetNamePrefixes?": ["string"],
            instanceType: "string",
            volumeSize: "number",
            // "userData?": "object",
            "userDataReplaceOnChange?": "boolean"
        })
            .ensure(t => t.volumeSize > 0 && t.volumeSize <= 1000, "volumeSize must be between 1 and 1000 inclusive");
        this._config = config;
        switch (this._config.instanceType) {
            case "small":
                this._instanceType = aws.ec2.InstanceType.T3_Medium;
                break;
            case "medium":
                this._instanceType = aws.ec2.InstanceType.T3_Large;
                break;
            case "large":
                this._instanceType = aws.ec2.InstanceType.T3_XLarge;
                break;
            case "xlarge":
                this._instanceType = aws.ec2.InstanceType.T3_2XLarge;
                break;
            default:
                ensureExhaustiveCheck(this._config.instanceType);
        }
    }
    async provision() {
        const ingressCidrBlocks = this._config.ingressSubnetNamePrefixes != null
            && this._config.ingressSubnetNamePrefixes.isNotEmpty
            ? this._config.vpcDetails
                .resolveSubnets(this._config.ingressSubnetNamePrefixes)
                .map(u => u.cidrBlock)
            // .apply(subnets => subnets.map(u => u.cidrBlock))
            : ["0.0.0.0/0"];
        const rdpPort = 3389;
        const secGroupName = `${this._name}-sg`;
        const secGroup = new aws.ec2.SecurityGroup(secGroupName, {
            vpcId: this._config.vpcDetails.vpc.id,
            revokeRulesOnDelete: true,
            ingress: [{
                    protocol: "tcp",
                    fromPort: rdpPort,
                    toPort: rdpPort,
                    cidrBlocks: ingressCidrBlocks
                }],
            egress: [{
                    fromPort: 0,
                    toPort: 0,
                    protocol: "-1",
                    cidrBlocks: ["0.0.0.0/0"],
                    ipv6CidrBlocks: ["::/0"]
                }],
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: secGroupName })
        }, {
        // replaceOnChanges: ["*"]
        });
        const ec2Ami = await aws.ec2.getAmi({
            mostRecent: true,
            owners: ["amazon"],
            filters: [
                {
                    name: "name",
                    values: ["Windows_Server-2019-English-Full-Base-*"]
                },
                {
                    name: "virtualization-type",
                    values: ["hvm"]
                }
            ]
        });
        const bastionSubnets = this._config.vpcDetails
            .resolveSubnets([this._config.subnetNamePrefix]);
        const firstSubnet = bastionSubnets[0];
        const privateKey = new tls.PrivateKey(`${this._name}-private-key`, {
            algorithm: "RSA",
            rsaBits: 2048
        });
        const keyPairName = `${this._name}-key-pair`;
        const keyPair = new aws.ec2.KeyPair(keyPairName, {
            publicKey: privateKey.publicKeyOpenssh,
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: keyPairName })
        });
        const bastionName = `${this._name}-ins`;
        const bastion = new aws.ec2.Instance(bastionName, {
            ami: ec2Ami.id,
            instanceType: this._instanceType,
            subnetId: firstSubnet.id,
            vpcSecurityGroupIds: [secGroup.id],
            associatePublicIpAddress: firstSubnet.prefix
                .toLowerCase().contains("public"),
            // .apply(t => t.toLowerCase().contains("public")),
            iamInstanceProfile: this._createIamInstanceProfile(),
            keyName: keyPair.keyName,
            userData: this._config.userData,
            userDataReplaceOnChange: this._config.userDataReplaceOnChange,
            rootBlockDevice: {
                deleteOnTermination: true,
                volumeSize: this._config.volumeSize,
                volumeType: "gp2"
            },
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: bastionName })
        }, {
            ignoreChanges: ["ami"]
        });
        return {
            publicDns: bastion.publicDns,
            publicIp: bastion.publicIp,
            privateDns: bastion.privateDns,
            privateIp: bastion.privateIp,
            privateKeyOpenssh: privateKey.privateKeyOpenssh,
            privateKeyPem: privateKey.privateKeyPem,
            privateKeyPemPkcs8: privateKey.privateKeyPemPkcs8,
            publicKeyFingerprintMd5: privateKey.publicKeyFingerprintMd5,
            publicKeyFingerprintSha256: privateKey.publicKeyFingerprintSha256,
            publicKeyOpenssh: privateKey.publicKeyOpenssh,
            publicKeyPem: privateKey.publicKeyPem
        };
    }
    _createIamInstanceProfile() {
        const instancePolicies = new Array();
        if (this._config.policies != null && this._config.policies.isNotEmpty)
            instancePolicies.push(...this._config.policies);
        const managedPolicies = [
            ...instancePolicies.where(t => typeof t === "string"),
            // aws.iam.ManagedPolicy.CloudWatchFullAccess,
            "arn:aws:iam::aws:policy/CloudWatchFullAccessV2"
        ];
        const policyDocs = instancePolicies
            .where(t => typeof t !== "string");
        const createdPolicies = policyDocs.map((policyDoc, index) => {
            const policyName = `${this._name}-rp-${index}`;
            const policy = new aws.iam.Policy(policyName, {
                policy: policyDoc,
                tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: policyName })
            });
            return policy;
        });
        const assumeRolePolicyDocument = {
            Version: "2012-10-17",
            Statement: [
                {
                    Action: "sts:AssumeRole",
                    Effect: "Allow",
                    "Principal": {
                        "Service": "ec2.amazonaws.com"
                    }
                }
            ]
        };
        const roleName = `${this._name}-rle`;
        const role = new aws.iam.Role(roleName, {
            assumeRolePolicy: assumeRolePolicyDocument,
            managedPolicyArns: [
                ...managedPolicies,
                ...createdPolicies.map(t => t.arn)
            ],
            forceDetachPolicies: true,
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: roleName })
        }, { dependsOn: createdPolicies });
        const instanceProfileName = `${this._name}-ipr`;
        const instanceProfile = new aws.iam.InstanceProfile(instanceProfileName, {
            role,
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: instanceProfileName })
        });
        return instanceProfile;
    }
}
//# sourceMappingURL=windows-bastion-provisioner.js.map