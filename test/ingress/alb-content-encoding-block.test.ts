import * as Assert from "assert";
import test, { describe } from "node:test";
import { createTestVpcDetails, findResource, initializePulumiMocks, provisionTestAlb, settleResources, testCertificateArn, waitForResource } from "../app/app-test-harness.js";


await initializePulumiMocks();
const vpcDetails = createTestVpcDetails();
const listenerRuleType = "aws:lb/listenerRule:ListenerRule";

async function getPriority(ruleName: string): Promise<unknown>
{
    const rule = await waitForResource(listenerRuleType, ruleName);
    return rule.inputs["priority"];
}

await describe("Alb Content-Encoding br block rule (CVE-2026-111497)", async () =>
{
    await test("every ALB answers Content-Encoding br requests with 415 from a fixed-response rule on its listener", async () =>
    {
        provisionTestAlb("alb-br-d", vpcDetails, {});
        const rule = await waitForResource(listenerRuleType, "alb-br-d-br-lrl");
        Assert.strictEqual(rule.inputs["priority"], 999);
        Assert.strictEqual(rule.inputs["listenerArn"], "arn:aws:mock:alb-br-d-ht-lnr");
        Assert.deepStrictEqual(rule.inputs["conditions"],
            [{ httpHeader: { httpHeaderName: "Content-Encoding", values: ["*br*"] } }]);
        Assert.deepStrictEqual(rule.inputs["actions"], [{
            type: "fixed-response",
            fixedResponse: { contentType: "text/plain", messageBody: "Unsupported Content-Encoding", statusCode: "415" }
        }]);
    });

    await test("with TLS the rule is attached to the HTTPS listener, not the redirect listener", async () =>
    {
        provisionTestAlb("alb-br-t", vpcDetails, { certificateArn: testCertificateArn });
        const rule = await waitForResource(listenerRuleType, "alb-br-t-br-lrl");
        Assert.strictEqual(rule.inputs["listenerArn"], "arn:aws:mock:alb-br-t-hts-lnr");
    });

    await test("default host with a path pattern: block rule at 999, forward rule at 1000", async () =>
    {
        provisionTestAlb("alb-br-p", vpcDetails, { targets: [{ host: "default", healthCheckPath: "/health", pathPattern: "/api" }] });
        Assert.strictEqual(await getPriority("alb-br-p-br-lrl"), 999);
        Assert.strictEqual(await getPriority("alb-br-p-dp-lrl"), 1000);
    });

    await test("named hosts: block rule at 999, host rules from 1001 in target order", async () =>
    {
        provisionTestAlb("alb-br-h", vpcDetails, {
            targets: [
                { host: "one.example.com", healthCheckPath: "/health" },
                { host: "two.example.com", healthCheckPath: "/health" }
            ]
        });
        Assert.strictEqual(await getPriority("alb-br-h-br-lrl"), 999);
        Assert.strictEqual(await getPriority("alb-br-h-lrl-0"), 1001);
        Assert.strictEqual(await getPriority("alb-br-h-lrl-1"), 1002);
    });

    await test("justAlb creates no listener and therefore no block rule", async () =>
    {
        provisionTestAlb("alb-br-j", vpcDetails, { justAlb: true });
        await settleResources();
        Assert.strictEqual(findResource(listenerRuleType, "alb-br-j-br-lrl"), null);
    });
});
