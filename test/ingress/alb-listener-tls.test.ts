import * as Assert from "assert";
import test, { describe } from "node:test";
import { createTestVpcDetails, initializePulumiMocks, provisionTestAlb, testCertificateArn, waitForResource } from "../app/app-test-harness.js";


await initializePulumiMocks();
const vpcDetails = createTestVpcDetails();
const listenerType = "aws:lb/listener:Listener";
const expectedSslPolicy = "ELBSecurityPolicy-TLS13-1-2-2021-06";

interface Origin
{
    customOriginConfig: {
        originSslProtocols: Array<string>;
    };
}

await describe("Alb HTTPS listener TLS policy", async () =>
{
    await test("the HTTPS listener terminates 443 with the certificate and allows TLS 1.2 and 1.3 only", async () =>
    {
        provisionTestAlb("alb-tls-s", vpcDetails, { certificateArn: testCertificateArn });
        const listener = await waitForResource(listenerType, "alb-tls-s-hts-lnr");
        Assert.strictEqual(listener.inputs["sslPolicy"], expectedSslPolicy);
        Assert.strictEqual(listener.inputs["protocol"], "HTTPS");
        Assert.strictEqual(listener.inputs["port"], 443);
        Assert.strictEqual(listener.inputs["certificateArn"], testCertificateArn);
        Assert.strictEqual(listener.inputs["loadBalancerArn"], "arn:aws:mock:alb-tls-s-alb");
    });

    await test("a named host's HTTPS listener uses the same policy", async () =>
    {
        provisionTestAlb("alb-tls-n", vpcDetails, { certificateArn: testCertificateArn, targets: [{ host: "one.example.com", healthCheckPath: "/health" }] });
        const listener = await waitForResource(listenerType, "alb-tls-n-hts-lnr");
        Assert.strictEqual(listener.inputs["sslPolicy"], expectedSslPolicy);
    });

    await test("the plain HTTP listener serves 80 with no certificate and no TLS policy", async () =>
    {
        provisionTestAlb("alb-tls-h", vpcDetails, {});
        const listener = await waitForResource(listenerType, "alb-tls-h-ht-lnr");
        Assert.strictEqual(listener.inputs["sslPolicy"], undefined);
        Assert.strictEqual(listener.inputs["protocol"], "HTTP");
        Assert.strictEqual(listener.inputs["port"], 80);
        Assert.strictEqual(listener.inputs["certificateArn"], undefined);
        Assert.strictEqual(listener.inputs["loadBalancerArn"], "arn:aws:mock:alb-tls-h-alb");
    });

    await test("the CloudFront origin offers only TLS 1.2 to the HTTPS listener", async () =>
    {
        provisionTestAlb("alb-tls-cf", vpcDetails, { certificateArn: testCertificateArn, enableCloudfront: true });
        const distribution = await waitForResource("aws:cloudfront/distribution:Distribution", "alb-tls-cf-cf-distro");
        const origins = distribution.inputs["origins"] as Array<Origin>;
        Assert.deepStrictEqual(origins[0].customOriginConfig.originSslProtocols, ["TLSv1.2"]);
    });
});
