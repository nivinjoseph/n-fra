import { given } from "@nivinjoseph/n-defensive";
import * as aws from "@pulumi/aws";
import { NfraConfig } from "../../common/nfra-config.js";
export class PolicyProvisioner {
    constructor(name, config) {
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
        given(config, "config").ensureHasValue().ensureHasStructure({
            document: "object",
            "userName?": "object",
            "roleName?": "object"
        });
        this._config = config;
    }
    provision() {
        const policyName = `${this._name}-pol`;
        const policy = new aws.iam.Policy(policyName, {
            path: "/",
            policy: this._config.document,
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: policyName })
        });
        if (this._config.userName != null) {
            new aws.iam.UserPolicyAttachment(`${this._name}-upa`, {
                policyArn: policy.arn,
                user: this._config.userName
            });
        }
        if (this._config.roleName != null) {
            new aws.iam.RolePolicyAttachment(`${this._name}-rpa`, {
                policyArn: policy.arn,
                role: this._config.roleName
            });
        }
        return {
            policyArn: policy.arn
        };
    }
}
//# sourceMappingURL=policy-provisioner.js.map