import * as Pulumi from "@pulumi/pulumi";
export interface ValkeyDetails {
    /**
     * @description The configuration endpoint when isClusterMode is true, the primary endpoint otherwise.
     */
    host: Pulumi.Output<string>;
    port: number;
    /**
     * @description True when in transit encryption is enabled. Clients must connect over TLS (rediss://).
     */
    tls: boolean;
    /**
     * @description True when cluster mode is enabled. Clients must be cluster aware and connect to host
     * as the configuration endpoint.
     */
    isClusterMode: boolean;
    /**
     * @description Connection url for host and port, with the scheme reflecting tls
     * (rediss:// when enabled, redis:// otherwise).
     * When isClusterMode is true this is the discovery endpoint, so pass it to a cluster aware
     * client as the seed node rather than treating it as a single server.
     */
    url: Pulumi.Output<string>;
}
//# sourceMappingURL=valkey-details.d.ts.map