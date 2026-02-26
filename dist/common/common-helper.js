import { given } from "@nivinjoseph/n-defensive";
import { NfraConfig } from "./nfra-config.js";
export class CommonHelper {
    constructor() { }
    static prefixName(name) {
        given(name, "name").ensureHasValue().ensureIsString();
        name = name.trim();
        const prefix = `${NfraConfig.project}-${NfraConfig.env}`;
        if (!name.startsWith(prefix))
            name = `${prefix}-${name}`;
        return name;
    }
}
//# sourceMappingURL=common-helper.js.map