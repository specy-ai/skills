import type { AstNode } from 'langium';

/**
 * Serialize a Langium AST node to a plain JSON object,
 * stripping internal properties ($container, $document, $cstNode, etc.)
 */
export function astToJson(node: AstNode): unknown {
    return serializeNode(node);
}

function serializeNode(node: AstNode): Record<string, unknown> {
    const result: Record<string, unknown> = {
        $type: node.$type,
    };

    for (const [key, value] of Object.entries(node)) {
        // Skip Langium internal properties
        if (key.startsWith('$')) continue;

        if (value === undefined || value === null) continue;

        if (Array.isArray(value)) {
            const arr = value
                .map(item => serializeValue(item))
                .filter(item => item !== undefined);
            if (arr.length > 0) {
                result[key] = arr;
            }
        } else {
            const serialized = serializeValue(value);
            if (serialized !== undefined) {
                result[key] = serialized;
            }
        }
    }

    return result;
}

function serializeValue(value: unknown): unknown {
    if (value === undefined || value === null) return undefined;

    // Primitive values
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }

    // AstNode (has $type)
    if (typeof value === 'object' && '$type' in (value as Record<string, unknown>)) {
        return serializeNode(value as AstNode);
    }

    // Reference (has $refText)
    if (typeof value === 'object' && '$refText' in (value as Record<string, unknown>)) {
        return (value as { $refText: string }).$refText;
    }

    return undefined;
}
