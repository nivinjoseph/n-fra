import { given } from "@nivinjoseph/n-defensive";
import * as Pulumi from "@pulumi/pulumi";
import { SecretsCache } from "./secrets-cache.js";
// import { Secret, SecretVersion } from "@pulumi/aws/secretsmanager";
import * as aws from "@pulumi/aws";
import { NfraConfig } from "../common/nfra-config.js";
export class SecretProvisioner {
    provision(name, value) {
        given(name, "name").ensureHasValue().ensureIsString();
        given(value, "value").ensureHasValue();
        if (!SecretsCache.contains(name)) {
            const secretValue = Pulumi.secret(value);
            const secretName = `${name}-secret`;
            const secret = new aws.secretsmanager.Secret(secretName, {
                forceOverwriteReplicaSecret: true,
                tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: secretName })
            });
            new aws.secretsmanager.SecretVersion(`${secretName}-version`, {
                secretId: secret.id,
                secretString: secretValue,
                versionStages: ["AWSCURRENT"]
            });
            SecretsCache.store({
                name,
                arn: secret.arn
            });
        }
        return SecretsCache.retrieve(name);
    }
}
//# sourceMappingURL=secret-provisioner.js.map