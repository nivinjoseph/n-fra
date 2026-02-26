import { given } from "@nivinjoseph/n-defensive";
export class SecretsCache {
    /**
     * @static
     */
    constructor() { }
    static contains(name) {
        given(name, "name").ensureHasValue().ensureIsString();
        name = name.trim();
        return this._map.has(name);
    }
    static store(secret) {
        given(secret, "secret").ensureHasValue().ensureIsObject()
            .ensure(t => !this._map.has(t.name), "duplicate secret");
        this._map.set(secret.name, secret);
    }
    static retrieve(name) {
        given(name, "name").ensureHasValue().ensureIsString().ensure(t => this._map.has(t.trim()), "secret not found");
        name = name.trim();
        return this._map.get(name);
    }
}
SecretsCache._map = new Map();
//# sourceMappingURL=secrets-cache.js.map