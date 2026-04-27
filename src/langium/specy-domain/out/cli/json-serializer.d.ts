import type { AstNode } from 'langium';
/**
 * Serialize a Langium AST node to a plain JSON object,
 * stripping internal properties ($container, $document, $cstNode, etc.)
 */
export declare function astToJson(node: AstNode): unknown;
