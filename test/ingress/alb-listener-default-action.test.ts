import * as Assert from "assert";
import test, { describe } from "node:test";
import { createTestVpcDetails, initializePulumiMocks, provisionTestAlb, waitForResource } from "../app/app-test-harness.js";
import type { AlbTarget } from "../../src/ingress/alb/alb-target.js";


await initializePulumiMocks();
const vpcDetails = createTestVpcDetails();
const listenerType = "aws:lb/listener:Listener";
const notFound = [{ type: "fixed-response", fixedResponse: { contentType: "text/plain", messageBody: "Not found", statusCode: "404" } }];

function provisionAlb(name: string, targets: Array<AlbTarget>): void
{
    provisionTestAlb(name, vpcDetails, { targets });
}

await describe("Alb listener default action", async () =>
{
    await test("default host without a path pattern forwards to the default target group", async () =>
    {
        provisionAlb("alb-da-d", [{ host: "default", healthCheckPath: "/health" }]);
        const listener = await waitForResource(listenerType, "alb-da-d-ht-lnr");
        Assert.deepStrictEqual(listener.inputs["defaultActions"], [{ type: "forward", targetGroupArn: "arn:aws:mock:alb-da-d-tg-d" }]);
    });

    await test("default host with a path pattern answers 404 by default and forwards only through its rule", async () =>
    {
        provisionAlb("alb-da-p", [{ host: "default", healthCheckPath: "/health", pathPattern: "/api" }]);
        const listener = await waitForResource(listenerType, "alb-da-p-ht-lnr");
        Assert.deepStrictEqual(listener.inputs["defaultActions"], notFound);
    });

    await test("named hosts answer 404 by default", async () =>
    {
        provisionAlb("alb-da-n", [
            { host: "one.example.com", healthCheckPath: "/health" },
            { host: "two.example.com", healthCheckPath: "/health" }
        ]);
        const listener = await waitForResource(listenerType, "alb-da-n-ht-lnr");
        Assert.deepStrictEqual(listener.inputs["defaultActions"], notFound);
    });
});
