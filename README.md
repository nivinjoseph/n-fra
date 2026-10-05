# n-fra

Opinionated AWS infrastructure building blocks for [Pulumi](https://www.pulumi.com/), written in TypeScript. Each block is a *provisioner*: you construct it with a `name` and a typed `*Config`, call `provision()`, and get back a `*Details` object whose outputs feed the next block. Configs are validated in the constructor, so most mistakes fail before `pulumi preview` touches AWS.

```ts
const vpcDetails = new VpcProvisioner("demo", vpcConfig).provision();
const database = new PostgresInstanceProvisioner("demo-db", { vpcDetails, ... }).provision();
```

## What it provisions

| Area | Classes | AWS |
|---|---|---|
| Network | `VpcProvisioner`, `SubnetPool`, `SecurityGroupHelper` | VPC, subnets, NAT, private DNS namespace |
| Apps | `HttpAppProvisioner`, `GrpcAppProvisioner`, `WorkerAppProvisioner`, `AppProvisioner.provisionAppCluster` | ECS Fargate services, autoscaling, Service Connect |
| Ingress | `AlbProvisioner`, `NlbProvisioner` | Application / Network Load Balancer, WAF |
| Databases | `PostgresInstanceProvisioner`, `MariaInstanceProvisioner`, `Aspv2Provisioner`, `RdsProxyProvisioner`, `MongoDocumentdbProvisioner` | RDS, Aurora Serverless v2 Postgres (`Aspv2`), RDS Proxy, DocumentDB |
| Caches | `ValkeyProvisioner`, `RedisProvisioner`, `MemorydbProvisioner` | ElastiCache, MemoryDB |
| Queues | `KafkaMskProvisionedProvisioner`, `KafkaMskServerlessProvisioner`, `RabbitAmazonmqProvisioner` | MSK, Amazon MQ |
| Storage | `S3bucketProvisioner`, `EfsProvisioner` | S3, EFS |
| Security | `SecretProvisioner`, `PolicyProvisioner`, `AccessUserProvisioner` | Secrets Manager, IAM |
| Observability | `DatadogIntegrationProvisioner` | Datadog AWS integration, forwarder |
| Bastion | `WindowsBastionProvisioner` | EC2 |
| Orchestration | `CustomerProvisioner`, `EnvironmentProvisioner`, `NfraConfig` | Pulumi program entry and stack settings |

Abbreviations: `Aspv2` = Aurora Serverless Postgres v2; `Nfra` = this library; `ddHost` = the Datadog *site* (e.g. `datadoghq.com`).

## Prerequisites

- Node.js `>= 24.10`, a Pulumi project, and the Pulumi AWS provider credentials.
- **Stack name** must be one of `dev`, `test`, `stage`, `prod` (`EnvType`). Several defaults switch on `prod` (3 NAT gateways, 3 Aurora instances, longer backup retention).
- **Pulumi config** `aws:region` is required. `aws:allowedAccountIds` (a single 12-digit account) is required whenever an app image comes from your ECR or the Datadog integration is used:
  ```sh
  pulumi config set aws:region us-east-1
  pulumi config set aws:allowedAccountIds '["123456789012"]'
  ```
- **AWS credentials in the environment** during `pulumi preview`/`up`: app provisioners verify that the image tag exists in ECR with `DescribeImages`. Images starting with `docker.` or `public.ecr.` are used verbatim and skip this check.
- Importing the package also imports `@nivinjoseph/n-ext`, which adds helper methods such as `.contains()`, `.where()`, `.distinct()` to `Array`, `String` and `Object` prototypes. The library's source uses them throughout.

## Project layout

`CustomerProvisioner` is the Pulumi program entry. It requires the working directory to end with the Pulumi project name, loads `./envs/<stack>.js` (your compiled `envs/<stack>.ts`), and runs its default export, which must be a zero-argument `EnvironmentProvisioner` subclass.

```
my-platform/              # folder name == Pulumi project name
  Pulumi.yaml             # name: my-platform
  index.ts                # Pulumi entry point
  envs/
    dev.ts                # one file per stack: dev.ts, test.ts, stage.ts, prod.ts
    prod.ts
```

`index.ts`:

```ts
import { CustomerProvisioner } from "@nivinjoseph/n-fra";

// Must be exported under exactly this name: other stacks read it with EnvironmentProvisioner.fetchEnvironmentOutput().
export const stackOutput = await new CustomerProvisioner().provision();
```

`envs/dev.ts` (the full example is below):

```ts
import { EnvironmentProvisioner, type EnvironmentOutput } from "@nivinjoseph/n-fra";

export default class DevEnvironment extends EnvironmentProvisioner<EnvironmentOutput>
{
    protected async provisionEnvironment(): Promise<EnvironmentOutput>
    {
        // ...provisioners...
        return { albDnsName: alb.dnsName, dbHost: database.host };
    }
}
```

Call `NfraConfig.configureTags(...)` and the other `NfraConfig.configure*` methods before constructing any provisioner; tags and overrides are read when each resource is created.

## Subnets are referenced by prefix

Every module locates subnets through a **prefix** that matches `VpcSubnetConfig.prefix`: `subnetNamePrefix` (where the resource lives), `ingressSubnetNamePrefixes` (whose CIDRs may reach it), `egressSubnetNamePrefixes` (ALB only) and `dbSubnetNamePrefix` (RDS Proxy). Rules:

- A prefix must contain the word `public`, `private` or `isolated`, and each subnet `name` must start with its prefix. `SubnetPool.reserveSubnets(prefix, type, count)` generates valid, non-overlapping subnets.
- Matching is by `startsWith`, so `"private"` selects both `"private-app"` and `"private-db"`.
- A prefix that matches no subnet throws at provision time, listing the prefixes that exist.

## Container contract

| App type | Port | ECS health check | Image must contain |
|---|---|---|---|
| `HttpAppProvisioner` | 80 (or `defaultAppPortOverride`) | `curl http://localhost:<port>/healthCheck` | `curl`, a `GET /healthCheck` route |
| `GrpcAppProvisioner` | 50051 | `grpc-health-probe` | `/usr/local/bin/grpc-health-probe`, gRPC health service |
| `WorkerAppProvisioner` | 8080 (health only) | `curl http://localhost:8080/healthCheck` | `curl`, a `GET /healthCheck` route |

The `AlbTarget.healthCheckPath` is the load balancer's own check and is independent of the container probe above. Images are tagged `<repository>:vX.Y.Z`; the `vX.Y.Z` part becomes the app `version`. Containers run as read-only root filesystems on ARM64 by default.

## End-to-end example

This mirrors `test/composition/environment.test.ts`, which runs the same composition under Pulumi mocks on every `yarn test`, so it satisfies every constructor rule.

```ts
import {
    AlbProvisioner, AppProvisioner, EnvironmentProvisioner, HttpAppProvisioner, PostgresInstanceProvisioner,
    SecretProvisioner, SubnetPool, VpcProvisioner, VpcSubnetType, WorkerAppProvisioner, type EnvironmentOutput
} from "@nivinjoseph/n-fra";

export default class DevEnvironment extends EnvironmentProvisioner<EnvironmentOutput>
{
    protected async provisionEnvironment(): Promise<EnvironmentOutput>
    {
        // 1. Network. Prefixes must contain "public", "private" or "isolated".
        const pool = new SubnetPool("10.0.0.0/16", 8);
        const vpcDetails = new VpcProvisioner("demo", {
            cidrRange: "10.0.0.0/16",
            subnets: [
                ...pool.reserveSubnets("public-ingress", VpcSubnetType.public, 2),
                ...pool.reserveSubnets("private-app", VpcSubnetType.private, 2),
                ...pool.reserveSubnets("isolated-db", VpcSubnetType.isolated, 2)
            ]
        }).provision();

        // 2. One ECS cluster shared by the apps.
        const cluster = AppProvisioner.provisionAppCluster("demo", {}, vpcDetails);

        // 3. Database in the isolated subnets, reachable from the app subnets; its generated password becomes a secret.
        const database = new PostgresInstanceProvisioner("demo-db", {
            vpcDetails, subnetNamePrefix: "isolated-db", ingressSubnetNamePrefixes: ["private-app"],
            databaseName: "app", instanceClass: "db.t4g.micro", storageGb: 20, maxStorageGb: 100
        }).provision();
        const dbPassword = new SecretProvisioner().provision("DB_PASSWORD", database.password);

        // 4. Public load balancer that may send traffic to the app subnets.
        const alb = new AlbProvisioner("demo", {
            vpcDetails, subnetNamePrefix: "public-ingress", egressSubnetNamePrefixes: ["private-app"],
            targets: [{ host: "default", healthCheckPath: "/healthCheck" }]
        }).provision();

        // 5. Apps. The HTTP app accepts traffic from the ALB's subnets and registers with the ALB's default target group.
        await new HttpAppProvisioner("demo-api", {
            vpcDetails, subnetNamePrefix: "private-app", ingressSubnetNamePrefixes: ["public-ingress"],
            cluster, image: "demo-api:v1.0.0", command: ["node", "api.js"],
            envVars: [{ name: "DB_HOST", value: database.host }], secrets: [dbPassword],
            albTargetGroupArn: alb.hostTargets["default"].albTargetGroupArn
        }).provision();
        await new WorkerAppProvisioner("demo-worker", {
            vpcDetails, subnetNamePrefix: "private-app", cluster, image: "demo-worker:v1.0.0", command: ["node", "worker.js"],
            secrets: [dbPassword]
        }).provision();

        return { albDnsName: alb.dnsName, dbHost: database.host };
    }
}
```

Secrets are injected into containers as environment variables named after the secret (`DB_PASSWORD` above). Keep database passwords and API keys in `secrets`, not `envVars`.

## `provision()` return style

| Returns the details synchronously | Returns a `Promise` |
|---|---|
| `VpcProvisioner`, `AlbProvisioner`, `NlbProvisioner`, every database, cache, queue and storage provisioner, `PolicyProvisioner`, `AccessUserProvisioner`, `SecretProvisioner` | `HttpAppProvisioner`, `GrpcAppProvisioner`, `WorkerAppProvisioner` (they call ECR first), `WindowsBastionProvisioner`, `DatadogIntegrationProvisioner`, `EnvironmentProvisioner`, `CustomerProvisioner` |

## How misuse is reported

- Config shape and cross-field rules are checked in the constructor with `@nivinjoseph/n-defensive`. Messages name the field and the rule, e.g. `Argument 'config' is missing required property 'subnets.0.prefix'.` or `Argument 'config' minCapacity must be <= maxCapacity.`
- Mutually exclusive options are also encoded in the types: `cluster` vs `clusterConfig`, `command` vs `entryPoint` vs `useDockerfileCommandOrEntryPoint`, `databaseName` vs `restoreSnapshotId`. Supplying both fails `tsc`.
- Not checked by the library and only rejected by AWS at `pulumi up`: cache node types, Fargate CPU/memory pairs, Aurora ACU ranges, port ranges, resource name length limits (keep `name` short; an ALB gets `<name>-alb` and has a 32-character limit).

## Data safety: read before `pulumi destroy` or renaming

Resource names derive from the `name` you pass. Renaming a provisioner **replaces** its resources, and the library sets no `protect` or `retainOnDelete` options. Current defaults on stateful resources:

- S3 buckets are created with `forceDestroy: true`: deleting or renaming the bucket deletes every object.
- Postgres and MariaDB instances always use `skipFinalSnapshot: true` and `deletionProtection` defaults to `false`.
- DocumentDB clusters have deletion protection off and skip the final snapshot.
- Aurora Serverless v2 requires you to set `deletionProtection` and `skipFinalSnapshot` explicitly.

Set `deletionProtection: true` on production databases and take your own snapshots before structural changes.

## Upgrading from 5.0.x

The type-safety work in this version changes the public API. Bump the package version as a minor or major release, not a patch.

- **Removed:** `MongoEc2Config`, `MongoEc2Details`, `MongoFargateConfig`, `MongoFargateDetails` (their provisioners had been commented out for some time), and `AppConfig.sidecarConfig` with `AppSidecarConfig` (never implemented; it threw at provision time).
- **Config interfaces became type aliases:** `HttpAppConfig`, `GrpcAppConfig`, `WorkerAppConfig`, `PostgresInstanceConfig`, `MariaInstanceConfig`, `Aspv2Config` are now unions. `interface Mine extends HttpAppConfig` no longer compiles; write `type Mine = HttpAppConfig & { ... }` or extend the exported `AppConfigBase`, `PostgresInstanceConfigBase`, `MariaInstanceConfigBase` or `Aspv2ConfigBase`.
- **Mutual exclusion is now in the types** (it was already enforced at runtime): exactly one of `cluster` / `clusterConfig`; exactly one of `command` / `entryPoint` / `useDockerfileCommandOrEntryPoint: true`; exactly one of `databaseName` / `restoreSnapshotId`. `useDockerfileCommandOrEntryPoint` must be a literal `true` or `false`, not a `boolean` variable.
- **`instanceClass`** on Postgres and MariaDB is `RdsInstanceClass`: known classes autocomplete, any `db.<family>.<size>` literal is accepted, and a plain `string` variable needs `as RdsInstanceClass`.
- **`availabilityZone`** on Postgres and MariaDB is a `VpcAz` letter (`VpcAz.b`) instead of a full zone name; the region comes from `aws:region`.
- **Subnet prefixes that match nothing now throw** from `VpcDetails.resolveSubnets`, so a stale `ingressSubnetNamePrefixes` entry that used to resolve to an empty list fails at `pulumi preview` with the available prefixes listed.
- **Errors now raised at construction** (previously only inside `provision()`): unknown `computeProfile` and autoscaling on a spot cluster. The provision-time checks remain as a second line of defence.
- **Accepted more widely:** `restoreSnapshotId` and `albTargetGroupArn` take either a string or a Pulumi `Output` at runtime (previously each accepted only one of the two).

## Development

```sh
yarn typecheck     # tsc --noEmit, about 2 seconds
yarn ts-lint       # eslint (style rules are strict; see CLAUDE.md)
yarn test          # build + lint + node:test under Pulumi mocks, no AWS credentials needed
yarn test:only     # re-run the compiled tests without rebuilding
```

Contributor conventions, the test harness, and the publishing flow are described in [CLAUDE.md](CLAUDE.md). The committed `dist/` folder is what npm publishes; rebuild it with `yarn ts-build-dist` before publishing.
