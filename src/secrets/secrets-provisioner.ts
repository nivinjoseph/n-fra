import { given } from "@nivinjoseph/n-defensive";
import { SecretsCache } from "./secrets-cache";
import * as Pulumi from "@pulumi/pulumi";
// import { Secret, SecretVersion } from "@pulumi/aws/secretsmanager";
import * as aws from "@pulumi/aws";
import { InfraConfig } from "../infra-config";
import { AppSecret } from "./app-secret";


export class SecretsProvisioner
{
    public provision(name: string, value: string): AppSecret
    {
        given(name, "name").ensureHasValue().ensureIsString();
        given(value, "value").ensureHasValue().ensureIsString();
        
        if (!SecretsCache.contains(name))
        {
            const secretValue = Pulumi.secret(value.toString());

            const secretName = `${name}-secret`;
            const secret = new aws.secretsmanager.Secret(secretName, {
                forceOverwriteReplicaSecret: true,
                tags: {
                    ...InfraConfig.tags,
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