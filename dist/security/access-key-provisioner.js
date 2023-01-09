"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessKeyProvisioner = void 0;
const n_defensive_1 = require("@nivinjoseph/n-defensive");
const iam_1 = require("@pulumi/aws/iam");
const infra_config_1 = require("../infra-config");
class AccessKeyProvisioner {
    constructor(name) {
        (0, n_defensive_1.given)(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
    }
    provision() {
        const userName = `${this._name}-aku`;
        const user = new iam_1.User(userName, {
            path: "/system/aku/",
            tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: userName })
        });
        const accessKey = new iam_1.AccessKey(`${this._name}-ak`, {
            user: user.name
        });
        return {
            userArn: user.arn,
            accessKeyId: accessKey.id,
            accessKeySecret: accessKey.secret
        };
    }
}
exports.AccessKeyProvisioner = AccessKeyProvisioner;
//# sourceMappingURL=access-key-provisioner.js.map