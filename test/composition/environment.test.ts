import * as Assert from "assert";
import test, { describe } from "node:test";
import { initializePulumiMocks, testImage, waitForResource } from "../app/app-test-harness.js";
import {
    AlbProvisioner, AppProvisioner, HttpAppProvisioner, PostgresInstanceProvisioner, SecretProvisioner,
    SubnetPool, VpcProvisioner, VpcSubnetType, WorkerAppProvisioner
} from "../../src/index.js";


// This file is the README's end-to-end example, kept here so it is checked against every constructor rule under the Pulumi mocks.
await initializePulumiMocks();

// 1. Network. Subnet prefixes must contain "public", "private" or "isolated"; every other module refers to subnets by these prefixes.
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
    cluster, image: testImage, command: ["node", "api.js"],
    envVars: [{ name: "DB_HOST", value: database.host }], secrets: [dbPassword],
    albTargetGroupArn: alb.hostTargets["default"].albTargetGroupArn
}).provision();
await new WorkerAppProvisioner("demo-worker", {
    vpcDetails, subnetNamePrefix: "private-app", cluster, image: testImage, command: ["node", "worker.js"],
    secrets: [dbPassword]
}).provision();

await describe("composing an environment", async () =>
{
    await test("creates the VPC and one subnet per reservation", async () =>
    {
        await waitForResource("aws:ec2/vpc:Vpc", "demo-vpc");
        for (const name of ["public-ingress-1", "public-ingress-2", "private-app-1", "private-app-2", "isolated-db-1", "isolated-db-2"])
            await waitForResource("aws:ec2/subnet:Subnet", name);
    });

    await test("creates the cluster, database, secret, load balancer and both services", async () =>
    {
        await waitForResource("aws:ecs/cluster:Cluster", "demo-cls");
        await waitForResource("aws:rds/instance:Instance", "demo-db-postgres-db-ins");
        await waitForResource("aws:secretsmanager/secret:Secret", "DB_PASSWORD-secret");
        await waitForResource("aws:lb/loadBalancer:LoadBalancer", "demo-alb");
        await waitForResource("aws:lb/targetGroup:TargetGroup", "demo-tg-d");
        await waitForResource("aws:ecs/service:Service", "demo-api-svc");
        await waitForResource("aws:ecs/service:Service", "demo-worker-svc");
    });

    await test("registers the HTTP service with the ALB's default target group", async () =>
    {
        const service = await waitForResource("aws:ecs/service:Service", "demo-api-svc");
        const loadBalancers = service.inputs["loadBalancers"] as Array<Record<string, unknown>>;
        Assert.strictEqual(loadBalancers.length, 1);
        Assert.strictEqual(loadBalancers[0]["targetGroupArn"], "arn:aws:mock:demo-tg-d");
    });
});
