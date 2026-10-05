/**
 * Returns the values an enum accepts at runtime: the numbers of a numeric enum, or the strings of a string enum.
 */
export declare function enumValues(enumType: object): Array<string | number>;
/**
 * Renders the accepted values of an enum for an error message, e.g. `"Public, Private, Isolated"`.
 * Numeric enums are rendered by member name so the message reads `xsmall, small, ...` rather than `0, 1, ...`.
 */
export declare function enumValueList(enumType: object): string;
//# sourceMappingURL=validation-helper.d.ts.map