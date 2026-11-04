/**
 * JSON Schema validation of a document read as JSON or YAML, before it is
 * printed to DSL. The schema catches the structural mistakes a hand-written or
 * generated document can make (a missing name, a priority outside MoSCoW, a
 * populations entry without an entity) with a path into the document; the DSL
 * parser that follows catches the rest.
 */
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import type { Diagnostic } from './codec.js';

const compiled = new Map<string, ValidateFunction>();
let ajv: Ajv2020 | undefined;

function ajvOnce(): Ajv2020 {
    // strict schemas, but `required` is allowed inside oneOf/anyOf branches
    return (ajv ??= new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true }));
}

export function validateDocument(schema: Record<string, unknown>, doc: unknown): Diagnostic[] {
    const id = typeof schema.$id === 'string' ? schema.$id : JSON.stringify(schema).slice(0, 200);
    let validate = compiled.get(id);
    if (!validate) {
        validate = ajvOnce().compile(schema);
        compiled.set(id, validate);
    }
    if (validate(doc)) return [];
    return (validate.errors ?? []).map(e => ({
        severity: 'error' as const,
        line: 1,
        column: 1,
        message: `${e.instancePath || '/'} ${e.message ?? 'is invalid'}${e.params && 'allowedValues' in e.params ? ` (${(e.params.allowedValues as unknown[]).join(', ')})` : ''}${e.params && 'additionalProperty' in e.params ? `: ${String(e.params.additionalProperty)}` : ''}`,
        code: 'SCHEMA',
        source: 'schema' as const,
    }));
}
