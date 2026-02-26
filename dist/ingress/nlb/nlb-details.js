import { given } from "@nivinjoseph/n-defensive";
import * as aws from "@pulumi/aws";
import { NfraConfig } from "../../common/nfra-config.js";
export class NlbDetails {
    get arn() { return this._arn; }
    get host() { return this._host; }
    get port() { return this._port; }
    constructor(arn, host, port) {
        given(arn, "arn").ensureHasValue().ensureIsObject();
        this._arn = arn;
        given(host, "host").ensureHasValue().ensureIsObject();
        this._host = host;
        given(port, "port").ensureHasValue().ensureIsNumber();
        this._port = port;
    }
    createVpcEndpointService(name, allowedAwsAccounts) {
        given(name, "name").ensureHasValue().ensureIsString();
        given(allowedAwsAccounts, "allowedAwsAccounts").ensureHasValue().ensureIsNotEmpty();
        // vpc endpoint service principal
        // arn:aws:iam::667762432193:root
        const vpceName = `${name}-ves`;
        const vpce = new aws.ec2.VpcEndpointService(vpceName, {
            acceptanceRequired: false,
            networkLoadBalancerArns: [this._arn],
            supportedIpAddressTypes: ["ipv4"],
            allowedPrincipals: allowedAwsAccounts.map(accountId => `arn:aws:iam::${accountId}:root`),
            tags: Object.assign(Object.assign({}, NfraConfig.tags), { Name: vpceName })
        });
        return {
            serviceName: vpce.serviceName
        };
    }
}
//# sourceMappingURL=nlb-details.js.map