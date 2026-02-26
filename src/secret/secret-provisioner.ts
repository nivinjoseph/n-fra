import { given } from "@nivinjoseph/n-defensive";
import * as Pulumi from "@pulumi/pulumi";
import { SecretsCache } from "./secrets-cache.js";
// import { Secret, SecretVersion } from "@pulumi/aws/secretsmanager";
import * as aws from "@pulumi/aws";
import { NfraConfig } from "../common/nfra-config.js";
import type { Secret } from "./secret.js";


export class SecretProvisioner
{
    public provision(name: string, value: string | Pulumi.Output<string>): Secret
    {
        given(name, "name").ensureHasValue().ensureIsString();
        given(value, "value").ensureHasValue();

        if (!SecretsCache.contains(name))
        {
            const secretValue = Pulumi.secret(value);

            const secretName = `${name}-secret`;
            const secret = new aws.secretsmanager.Secret(secretName, {
                forceOverwriteReplicaSecret: true,
                tags: {
                    ...NfraConfig.tags,
                    Name: secretName
                }
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