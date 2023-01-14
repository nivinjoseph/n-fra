"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyProvisioner = void 0;
const n_defensive_1 = require("@nivinjoseph/n-defensive");
const aws = require("@pulumi/aws");
const nfra_config_1 = require("../../nfra-config");
class PolicyProvisioner {
    constructor(name, config) {
        (0, n_defensive_1.given)(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
        (0, n_defensive_1.given)(config, "config").ensureHasValue().ensureHasStructure({
            document: "object",
            "userName?": "string",
            "roleName?": "string"
        });
        this._config = config;
    }
    provision() {
        const policyName = `${this._name}-pol`;
        const policy = new aws.iam.Policy(policyName, {
            path: "/",
            policy: this._config.document,
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: policyName })
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
exports.PolicyProvisioner = PolicyProvisioner;
//# sourceMappingURL=policy-provisioner.js.map