import { given } from "@nivinjoseph/n-defensive";
import { NfraConfig } from "./nfra-config.js";
export var EnvType;
(function (EnvType) {
    EnvType["dev"] = "dev";
    EnvType["test"] = "test";
    EnvType["stage"] = "stage";
    EnvType["prod"] = "prod";
})(EnvType || (EnvType = {}));
export function isEnv(env) {
    given(env, "env").ensureHasValue().ensureIsEnum(EnvType);
    return NfraConfig.env === env;
}
//# sourceMappingURL=env-type.js.map