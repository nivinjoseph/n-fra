import { EnvType } from "./env-type.js";
import * as Pulumi from "@pulumi/pulumi";
import { given } from "@nivinjoseph/n-defensive";
import { VpcAz } from "../vpc/vpc-az.js";
export class NfraConfig {
    static get awsAccount() {
        const ids = this._pulumiAwsConfig.require("allowedAccountIds").toString();
        const numbers = "0123456789".split("");
        const id = ids.split("").filter(t => numbers.contains(t)).join("");
        if (id.length !== 12)
            throw new Error(`Invalid AWS account id ${id}`);
        return id;
    }
    static get awsRegion() { return this._pulumiAwsConfig.require("region"); }
    static get awsRegionAzs() {
        return this.awsRegion === "ca-central-1" ? [VpcAz.a, VpcAz.b, VpcAz.d] : [VpcAz.a, VpcAz.b, VpcAz.c];
    }
    static get awsRegionAvailabilityZones() {
        return this.awsRegionAzs.map(t => `${this.awsRegion}${t}`);
    }
    static get project() { return Pulumi.getProject(); }
    static get env() {
        const env = Pulumi.getStack();
        given(env, "env").ensureHasValue().ensureIsEnum(EnvType);
        return env;
    }
    static get appEnv() {
        return this._appEnvOverride != null ? this._appEnvOverride() : this.env;
    }
    static get tags() {
        return Object.assign({ provisioner: "n-fra", env: this.appEnv }, this._userTags);
    }
    static get ecrBase() {
        return `${this.ecrAwsAccountId}.dkr.ecr.${this.ecrAwsRegion}.amazonaws.com`;
    }
    static get ecrAwsAccountId() {
        return this._ecrAwsAccountIdOverride != null ? this._ecrAwsAccountIdOverride() : this.awsAccount;
    }
    static get ecrAwsRegion() {
        return this._ecrAwsRegionOverride != null ? this._ecrAwsRegionOverride() : this.awsRegion;
    }
    constructor() { }
    static configureTags(tags) {
        given(tags, "tags").ensureHasValue().ensureIsObject();
        this._userTags = tags;
    }
    static getConfig(key) {
        var _a, _b;
        return (_b = (_a = this._pulumiAppConfig.get(key)) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : null;
    }
    static requireConfig(key) {
        return this._pulumiAppConfig.require(key).toString();
    }
    static configureAppEnvOverride(func) {
        given(func, "func").ensureHasValue().ensureIsFunction();
        this._appEnvOverride = func;
    }
    static configureEcrAwsAccountIdOverride(func) {
        given(func, "func").ensureHasValue().ensureIsFunction();
        this._ecrAwsAccountIdOverride = func;
    }
    static configureEcrAwsRegionOverride(func) {
        given(func, "func").ensureHasValue().ensureIsFunction();
        this._ecrAwsRegionOverride = func;
    }
}
NfraConfig._pulumiAwsConfig = new Pulumi.Config("aws");
NfraConfig._pulumiAppConfig = new Pulumi.Config("nfra");
NfraConfig._userTags = {};
NfraConfig._appEnvOverride = null;
NfraConfig._ecrAwsAccountIdOverride = null;
NfraConfig._ecrAwsRegionOverride = null;
//# sourceMappingURL=nfra-config.js.map