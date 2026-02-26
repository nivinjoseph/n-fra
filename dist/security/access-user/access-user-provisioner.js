import { given } from "@nivinjoseph/n-defensive";
// import { AccessKey, User } from "@pulumi/aws/iam";
import * as aws from "@pulumi/aws";
import { NfraConfig } from "../../common/nfra-config.js";
export class AccessUserProvisioner {
    constructor(name) {
        given(name, "name").ensureHasValue().ensureIsString();
        this._name = name;
    }
    provision() {
        const userName = `${this._name}-auser`;
        const user = new aws.iam.User(userName, {
            path: "/system/auser/",
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: userName })
        });
        const accessKey = new aws.iam.AccessKey(`${this._name}-akey`, {
            user: user.name
        });
        return {
            userName: user.name,
            userArn: user.arn,
            accessKeyId: accessKey.id,
            accessKeySecret: accessKey.secret
        };
    }
}
//# sourceMappingURL=access-user-provisioner.js.map