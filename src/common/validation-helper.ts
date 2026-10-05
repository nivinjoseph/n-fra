/**
 * Returns the values an enum accepts at runtime: the numbers of a numeric enum, or the strings of a string enum.
 */
export function enumValues(enumType: object): Array<string | number>
{
    const values = Object.values(enumType) as Array<string | number>;
    const numericValues = values.where(t => typeof t === "number");
    return numericValues.isNotEmpty ? numericValues : values;
}

/**
 * Renders the accepted values of an enum for an error message, e.g. `"Public, Private, Isolated"`.
 * Numeric enums are rendered by member name so the message reads `xsmall, small, ...` rather than `0, 1, ...`.
 */
export function enumValueList(enumType: object): string
{
    const values = Object.values(enumType) as Array<string | number>;
    const hasNumericValues = values.some(t => typeof t === "number");
    const rendered = hasNumericValues
        ? Object.keys(enumType).where(t => isNaN(Number(t)))
        : values.map(t => t.toString());
    return rendered.join(", ");
}
