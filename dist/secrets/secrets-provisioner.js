"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecretsProvisioner = void 0;
const n_defensive_1 = require("@nivinjoseph/n-defensive");
const secrets_cache_1 = require("./secrets-cache");
const Pulumi = require("@pulumi/pulumi");
// import { Secret, SecretVersion } from "@pulumi/aws/secretsmanager";
const aws = require("@pulumi/aws");
const nfra_config_1 = require("../nfra-config");
class SecretsProvisioner {
    provision(name, value) {
        (0, n_defensive_1.given)(name, "name").ensureHasValue().ensureIsString();
        (0, n_defensive_1.given)(value, "value").ensureHasValue();
        if (!secrets_cache_1.SecretsCache.contains(name)) {
            const secretValue = Pulumi.secret(value);
            const secretName = `${name}-secret`;
            const secret = new aws.secretsmanager.Secret(secretName, {
                forceOverwriteReplicaSecret: true,
                tags: Object.assign(Object.assign({}, nfra_config_1.NfraConfig.tags), { Name: secretName })
            });
            new aws.secretsmanager.SecretVersion(`${secretName}-version`, {
                secretId: secret.id,
                secretString: secretValue,
                versionStages: ["AWSCURRENT"]
            });
            secrets_cache_1.SecretsCache.store({
                name,
                arn: secret.arn
            });
        }
        return secrets_cache_1.SecretsCache.retrieve(name);
    }
}
exports.SecretsProvisioner = SecretsProvisioner;
//# sourceMappingURL=secrets-provisioner.js.map