import { EnvType } from "./env-type.js";
import * as Pulumi from "@pulumi/pulumi";
import { given } from "@nivinjoseph/n-defensive";
import { VpcAz } from "../vpc/vpc-az.js";
export class NfraConfig {
    static _pulumiAwsConfig = new Pulumi.Config("aws");
    static _pulumiAppConfig = new Pulumi.Config("nfra");
    static _userTags = {};
    static _appEnvOverride = null;
    static _ecrAwsAccountIdOverride = null;
    static _ecrAwsRegionOverride = null;
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
        return {
            provisioner: "n-fra",
            env: this.appEnv,
            ...this._userTags
        };
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
        return this._pulumiAppConfig.get(key)?.toString() ?? null;
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
//# sourceMappingURL=nfra-config.js.map