"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessUserProvisioner = void 0;
const n_defensive_1 = require("@nivinjoseph/n-defensive");
// import { AccessKey, User } from "@pulumi/aws/iam";
const aws = require("@pulumi/aws");
const nfra_config_1 = require("../../nfra-config");
class AccessUserProvisioner {
    constructor(name) {
        (0, n_defensive_1.given)(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
    }
    provision() {
        const userName = `${this._name}-auser`;
        const user = new aws.iam.User(userName, {
            path: "/system/auser/",
            tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: userName })
        });
        const accessKey = new aws.iam.AccessKey(`${this._name}-akey`, {
            user: user.name
        });
        return {
            userArn: user.arn,
            accessKeyId: accessKey.id,
            accessKeySecret: accessKey.secret
        };
    }
}
exports.AccessUserProvisioner = AccessUserProvisioner;
//# sourceMappingURL=access-user-provisioner.js.map