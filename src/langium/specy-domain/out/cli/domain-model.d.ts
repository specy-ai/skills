import * as ast from '../generated/ast.js';
/**
 * Normalizer: Langium AST -> clean domain model (plain JS objects).
 *
 * The output drops Langium internals ($container, $cstNode, $type, ...) and
 * unwraps references/types into readable strings. Definitions are grouped by
 * kind (entities, values, events, ...) under their owning context/module so the
 * result reads as a tidy domain tree for JSON, YAML, and Markdown emitters.
 *
 * The grammar gives every definition TYPED SLOTS (identity=, fields=, operations=)
 * rather than one polymorphic bodyItems array, so each kind is projected directly.
 * Where a node has no dedicated handling it falls back to `cleanNode`, so no
 * information silently disappears.
 */
export interface FieldModel {
    name: string;
    type: string;
    optional?: boolean;
    constraints?: string[];
    description?: string;
    satisfies?: string[];
}
export interface OperationModel {
    name: string;
    description?: string;
    satisfies?: string[];
    /** Triggering command for command-triggered operations. */
    on?: string;
    trigger?: {
        command?: string;
    };
    accepts?: string[];
    returns?: string;
    /** safe = no mutation; unsafe = mutates domain state. */
    safety?: string;
    idempotent?: boolean;
    emits?: string[];
    /** Full cleaned clauses, so nothing is lost for JSON/YAML. */
    detail?: unknown[];
}
/** A normalized construct (entity, value, command, event, ...). */
export interface ConstructModel {
    kind: string;
    name: string;
    description?: string;
    satisfies?: string[];
    metadata?: Record<string, unknown>;
    fields?: FieldModel[];
    [key: string]: unknown;
}
export type DefinitionGroups = Record<string, ConstructModel[]>;
export interface RelationModel {
    direction: 'upstream' | 'downstream' | 'symmetric';
    pattern: string;
    target: string;
}
export interface ModuleModel {
    name: string;
    description?: string;
    metadata?: Record<string, unknown>;
    /** API interfaces — the module's public surface. */
    exposes?: string[];
    /** SPI interfaces — the capabilities the module needs from outside. */
    requires?: string[];
    /** Other modules this one depends on. */
    dependencies?: string[];
    definitions?: DefinitionGroups;
}
export interface ContextModel {
    name: string;
    shortname?: string;
    description?: string;
    metadata?: Record<string, unknown>;
    requirementsSource?: string;
    contextMap?: RelationModel[];
    modules?: ModuleModel[];
    definitions?: DefinitionGroups;
}
export interface OrganizationModel {
    name: string;
    description?: string;
    metadata?: Record<string, unknown>;
    requirementsSource?: string;
    contexts?: ContextModel[];
}
export interface DomainModel {
    organizations?: OrganizationModel[];
    contexts?: ContextModel[];
    modules?: ModuleModel[];
    definitions?: DefinitionGroups;
}
export declare function normalizeDomain(file: ast.DomainFile): DomainModel;
