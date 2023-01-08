"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecretsProvisioner = void 0;
const n_defensive_1 = require("@nivinjoseph/n-defensive");
const secrets_cache_1 = require("./secrets-cache");
const Pulumi = require("@pulumi/pulumi");
const secretsmanager_1 = require("@pulumi/aws/secretsmanager");
const infra_config_1 = require("../infra-config");
class SecretsProvisioner {
    provision(name, value) {
        (0, n_defensive_1.given)(name, "name").ensureHasValue().ensureIsString();
        (0, n_defensive_1.given)(value, "value").ensureHasValue().ensureIsString();
        if (!secrets_cache_1.SecretsCache.contains(name)) {
            const secretValue = Pulumi.secret(value.toString());
            const secretName = `${name}-secret`;
            const secret = new secretsmanager_1.Secret(secretName, {
                forceOverwriteReplicaSecret: true,
                tags: Object.assign(Object.assign({}, infra_config_1.InfraConfig.tags), { Name: secretName })
            });
            new secretsmanager_1.SecretVersion(`${secretName}-version`, {
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