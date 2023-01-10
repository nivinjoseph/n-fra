"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InfraConfig = void 0;
const env_type_1 = require("./env-type");
const Pulumi = require("@pulumi/pulumi");
const n_defensive_1 = require("@nivinjoseph/n-defensive");
class InfraConfig {
    static get awsAccount() { return this._pulumiAwsConfig.require("allowedAccountIds"); }
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
        var _a;
        return (_a = this._pulumiAppConfig.get(key)) !== null && _a !== void 0 ? _a : null;
    }
    static requireConfig(key) {
        return this._pulumiAppConfig.require(key);
    }
}
exports.InfraConfig = InfraConfig;
InfraConfig._pulumiAwsConfig = new Pulumi.Config("aws");
InfraConfig._pulumiAppConfig = new Pulumi.Config("nfra");
InfraConfig._userTags = null;
//# sourceMappingURL=infra-config.js.map