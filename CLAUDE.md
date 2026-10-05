# Working on n-fra

Pulumi-based AWS infrastructure library published as `@nivinjoseph/n-fra`. Consumer documentation is in [README.md](README.md); this file is for changing the library itself.

## Fast feedback loop

```sh
yarn typecheck      # tsc -p . --noEmit, ~2s. Run after every edit.
yarn ts-lint        # eslint; a lint error blocks `yarn test`
yarn lint:fix       # auto-fixes most style violations
yarn test           # tsc emit + eslint + node:test under Pulumi mocks (no AWS credentials needed)
yarn test:only      # re-run compiled tests without rebuilding
```

`tsc -p .` emits `.js` next to every `.ts` in `src/` and `test/` (gitignored). Run a single test file with `node --test --enable-source-maps test/<area>/<file>.test.js` after compiling.

## Style rules the linter enforces

These differ from common TypeScript defaults and will fail `yarn test` if ignored:

- Allman braces: `{` on its own line for classes, functions, control flow and arrow function bodies.
- `Array<T>` / `ReadonlyArray<T>`, never `T[]`.
- Explicit `public` / `protected` / `private` on every member, including constructors. Private members are `_camelCase`.
- Member order: fields, then accessors, then constructor, then static methods, then instance methods. Fields and accessors are ordered private, protected, public (static before instance); constructors and methods are ordered public, protected, private.
- Relative imports end in `.js` (`import { X } from "./x.js"`). One import statement per module: merge value and type imports with inline `type` (`import { A, type B } from ...`).
- Double quotes; no trailing commas in arrays, arguments or imports; no unnecessary parentheses.
- `no-floating-promises`, `no-unnecessary-condition` (do not null-check a value whose type cannot be null), `no-unnecessary-type-assertion` (drop `!` when the type is already narrowed).

## Not standard JavaScript

`src/index.ts` imports `@nivinjoseph/n-ext`, which adds methods to `Array`, `String` and `Object` prototypes. The source relies on them everywhere: `.contains()`, `.where()`, `.distinct()`, `.orderBy()`, `.take()`, `.takeFirst()`, `.takeLast()`, `.skip()`, `.groupBy()`, `.remove()`, `.count()`, `.isEmpty` / `.isNotEmpty` (properties, not methods), `.isEmptyOrWhiteSpace()`. `@nivinjoseph/n-defensive` imports n-ext as well, so the methods exist wherever `given` is imported; the test harness still loads `src/index.js` first so the module graph initializes in production order.

## Validation pattern

Every provisioner validates in its constructor, before anything touches Pulumi:

```ts
given(config, "config").ensureHasValue().ensureIsObject()
    .ensureHasStructure({ required: "string", "optional?": "number", list: ["string"], nested: { field: "boolean" } })
    .ensure(t => t.min <= t.max, "min must be <= max")
    .ensureWhen(config.x != null, t => ..., "x must ...");
```

- Messages name the field and the rule, include the offending value when useful, and list allowed values for enums via `enumValues` / `enumValueList` in `src/common/validation-helper.ts`.
- `ensureHasStructure` only knows `"string" | "number" | "boolean" | "object" | "array" | "function"` and nested shapes. A field typed `Pulumi.Input<string>` must not be in the structure schema; check it with `typeof t.x === "string" || Pulumi.Output.isInstance(t.x)` instead.
- Config types that are unions (`AppConfig`, `PostgresInstanceConfig`, `MariaInstanceConfig`, `Aspv2Config`) cannot be passed to `given()` directly; cast to the matching non-union `*Shape` type (`AppConfigShape`, `<X>ConfigBase & RdsInstanceSourceShape`). Keep the type-level XOR rules and the runtime checks in sync, and add a `// @ts-expect-error` case to `test/config-type-rules.test.ts` for every new compile-time rule.
- Checks that need a Pulumi resource (AZ span of resolved subnets, for example) live in `provision()`; everything else belongs in the constructor so it fails before `pulumi preview`.

## Module conventions

- `src/<area>/<module>/<module>-config.ts` (interface or type), `-details.ts` (what `provision()` returns), `-provisioner.ts` (`new XProvisioner(name, config).provision()`).
- `src/index.ts` is the only entry point (`package.json` `exports` forbids deep imports). Export every type a consumer could need to name, including base interfaces and the types referenced by exported ones.
- Every public config field carries JSDoc: purpose, `Default:`, constraint, and `Must match:` when it refers to another module's field. `src/cache/elasticache-valkey/valkey-config.ts` is the model.
- Subnets are referenced by `SubnetNamePrefix` (see `src/vpc/vpc-subnet-config.ts`) and resolved through `VpcDetails.resolveSubnets`, which throws for a prefix that matches nothing. Do not add another subnet lookup.
- Resource logical names are `${name}-<suffix>`; renaming replaces resources. Do not add `ignoreChanges` on ECS `desiredCount`, and keep the worker deployment percents at 0/100 (replacement-first 100/200 is for autoscaled gRPC/HTTP services only).

## Tests

- `node:test`, each file in its own process. Start every file that constructs a provisioner or a Pulumi resource with `await initializePulumiMocks()` from `test/app/app-test-harness.ts` (pure-function and type-only tests do not need it), which sets `aws:region`, `aws:allowedAccountIds` and stack name `test`, records every resource, and fakes `StackReference` outputs and RDS endpoints.
- Fixtures: `createTestVpcDetails()` (subnet prefixes `app` and `ingress`; hand-built, so `VpcProvisioner` rules do not apply), `createTestCluster()`, `testImage` (a `docker.io` image, which skips the ECR lookup).
- Provisioners return no resource handles, so tests find resources with `waitForResource(type, logicalName)` and assert absence with `settleResources()`.
- To exercise the ECR failure path offline, set `AWS_ENDPOINT_URL_ECR=http://127.0.0.1:9`, dummy `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, `AWS_EC2_METADATA_DISABLED=true` and `AWS_MAX_ATTEMPTS=1` before provisioning (see `test/app/image-verification.test.ts`). Never let a test reach real AWS.
- `test/composition/environment.test.ts` is the README example; keep the two in step.

## Publishing and `dist/`

- `dist/` is committed and is what npm ships (`files` in `package.json`). Regenerate it with `yarn ts-build-dist` after source changes; `tsc` does not delete outputs whose source was removed, so delete those by hand.
- `yarn publish-package` builds, commits, bumps the patch version, pushes and publishes in one go. Do not run it as part of ordinary work.

## Known gaps, intentionally unchanged so far

- Stateful resources use destructive defaults (`forceDestroy` on S3, `skipFinalSnapshot` on RDS, deletion protection off) and no `protect` option.
- `provision()` is synchronous for most provisioners and a `Promise` for app, bastion and Datadog provisioners.
- App provisioners return empty details objects. Most constructors (`VpcProvisioner`, `AlbProvisioner`, `Aspv2Provisioner`, the database and cache provisioners) write defaults into the config object passed in; `AppProvisioner` copies it first.
