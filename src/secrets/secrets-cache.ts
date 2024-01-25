import { given } from "@nivinjoseph/n-defensive";
import { Secret } from "./secret.js";


export class SecretsCache
{
    private static readonly _map = new Map<string, Secret>();

    /**
     * @static
     */
    private constructor() { }


    public static contains(name: string): boolean
    {
        given(name, "name").ensureHasValue().ensureIsString();
        name = name.trim();

        return this._map.has(name);
    }

    public static store(secret: Secret): void
    {
        given(secret, "secret").ensureHasValue().ensureIsObject()
            .ensure(t => !this._map.has(t.name), "duplicate secret");

        this._map.set(secret.name, secret);
    }

    public static retrieve(name: string): Secret
    {
        given(name, "name").ensureHasValue().ensureIsString().ensure(t => this._map.has(t.trim()), "secret not found");
        name = name.trim();

        return this._map.get(name)!;
    }
}