"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InfraConfig = void 0;
const env_type_1 = require("./env-type");
const pulumi = require("@pulumi/pulumi");
const n_defensive_1 = require("@nivinjoseph/n-defensive");
class InfraConfig {
    static get awsAccount() { return this._pulumiAwsConfig.require("account"); }
    static get awsRegion() { return this._pulumiAwsConfig.require("region"); }
    static get env() {
        const env = pulumi.getStack();
        (0, n_defensive_1.given)(env, "env").ensureHasValue().ensureIsEnum(env_type_1.EnvType);
        return env;
    }
    static get tags() {
        return {
            provisioner: "n-fra",
            env: this.env
        };
    }
    static get ecr() {
        return `${this.awsAccount}.dkr.ecr.${this.awsRegion}.amazonaws.com`;
    }
    constructor() { }
}
exports.InfraConfig = InfraConfig;
InfraConfig._pulumiAwsConfig = new pulumi.Config("aws");
//# sourceMappingURL=infra-config.js.map