/**
 * Serialize a Langium AST node to a plain JSON object,
 * stripping internal properties ($container, $document, $cstNode, etc.)
 */
export function astToJson(node) {
    return serializeNode(node);
}
function serializeNode(node) {
    const result = {
        $type: node.$type,
    };
    for (const [key, value] of Object.entries(node)) {
        // Skip Langium internal properties
        if (key.startsWith('$'))
            continue;
        if (value === undefined || value === null)
            continue;
        if (Array.isArray(value)) {
            const arr = value
                .map(item => serializeValue(item))
                .filter(item => item !== undefined);
            if (arr.length > 0) {
                result[key] = arr;
            }
        }
        else {
            const serialized = serializeValue(value);
            if (serialized !== undefined) {
                result[key] = serialized;
            }
        }
    }
    return result;
}
function serializeValue(value) {
    if (value === undefined || value === null)
        return undefined;
    // Primitive values
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    // AstNode (has $type)
    if (typeof value === 'object' && '$type' in value) {
        return serializeNode(value);
    }
    // Reference (has $refText)
    if (typeof value === 'object' && '$refText' in value) {
        return value.$refText;
    }
    return undefined;
}
//# sourceMappingURL=json-serializer.js.map