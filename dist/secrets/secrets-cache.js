"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecretsCache = void 0;
const n_defensive_1 = require("@nivinjoseph/n-defensive");
class SecretsCache {
    /**
     * @static
     */
    constructor() { }
    static contains(name) {
        (0, n_defensive_1.given)(name, "name").ensureHasValue().ensureIsString();
        name = name.trim();
        return this._map.has(name);
    }
    static store(secret) {
        (0, n_defensive_1.given)(secret, "secret").ensureHasValue().ensureIsObject()
            .ensure(t => !this._map.has(t.name), "duplicate secret");
        this._map.set(secret.name, secret);
    }
    static retrieve(name) {
        (0, n_defensive_1.given)(name, "name").ensureHasValue().ensureIsString().ensure(t => this._map.has(t.trim()), "secret not found");
        name = name.trim();
        return this._map.get(name);
    }
}
exports.SecretsCache = SecretsCache;
SecretsCache._map = new Map();
//# sourceMappingURL=secrets-cache.js.map