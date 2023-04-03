"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NfraConfig = void 0;
const env_type_1 = require("./env-type");
const Pulumi = require("@pulumi/pulumi");
const n_defensive_1 = require("@nivinjoseph/n-defensive");
class NfraConfig {
    static get awsAccount() {
        const ids = this._pulumiAwsConfig.require("allowedAccountIds").toString();
        const numbers = "0123456789".split("");
        const id = ids.split("").filter(t => numbers.contains(t)).join("");
        if (id.length !== 12)
            throw new Error(`Invalid AWS account id ${id}`);
        return id;
        // return ids.trim().substring(1, ids.length - 1);
    }
    static get awsRegion() { return this._pulumiAwsConfig.require("region"); }
    static get env() {
        const env = Pulumi.getStack();
        (0, n_defensive_1.given)(env, "env").ensureHasValue().ensureIsEnum(env_type_1.EnvType);
        return env;
    }
    static get tags() {
        return Object.assign({ provisioner: "n-fra", env: this.env }, this._userTags);
    }
    static get ecr() {
        return `${this.awsAccount}.dkr.ecr.${this.awsRegion}.amazonaws.com`;
    }
    constructor() { }
    static configureTags(tags) {
        (0, n_defensive_1.given)(tags, "tags").ensureHasValue().ensureIsObject();
        this._userTags = tags;
    }
    static getConfig(key) {
        var _a, _b;
        return (_b = (_a = this._pulumiAppConfig.get(key)) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : null;
    }
    static requireConfig(key) {
        return this._pulumiAppConfig.require(key).toString();
    }
}
exports.NfraConfig = NfraConfig;
NfraConfig._pulumiAwsConfig = new Pulumi.Config("aws");
NfraConfig._pulumiAppConfig = new Pulumi.Config("nfra");
NfraConfig._userTags = null;
//# sourceMappingURL=nfra-config.js.map