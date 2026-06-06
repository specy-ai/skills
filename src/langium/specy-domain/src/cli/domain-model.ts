import type { AstNode, Reference } from 'langium';
import * as ast from '../generated/ast.js';

/**
 * Normalizer: Langium AST -> clean domain model (plain JS objects).
 *
 * The output drops Langium internals ($container, $cstNode, $type, ...) and
 * unwraps references/types into readable strings. Definitions are grouped by
 * kind (entities, values, events, ...) under their owning context/module so the
 * result reads as a tidy domain tree for JSON, YAML, and Markdown emitters.
 *
 * Where a node has no dedicated handling it falls back to `cleanNode`, so no
 * information silently disappears.
 */

// ---------------------------------------------------------------------------
// Model types (the shape every emitter consumes)
// ---------------------------------------------------------------------------

export interface FieldModel {
    name: string;
    type: string;
    optional?: boolean;
    constraints?: string[];
}

export interface OperationModel {
    name: string;
    description?: string;
    satisfies?: string[];
    /** Triggering command/event for command/event-triggered operations. */
    on?: string;
    trigger?: { command?: string; event?: string };
    accepts?: string[];
    returns?: string;
    emits?: string[];
    /** Full cleaned clauses/items, so nothing is lost for JSON/YAML. */
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
    dependencies?: string[];
    modules?: ModuleModel[];
    definitions?: DefinitionGroups;
}

export interface ContextModel {
    name: string;
    shortname?: string;
    description?: string;
    metadata?: Record<string, unknown>;
    contextMap?: RelationModel[];
    modules?: ModuleModel[];
    definitions?: DefinitionGroups;
}

export interface OrganizationModel {
    name: string;
    description?: string;
    metadata?: Record<string, unknown>;
    contexts?: ContextModel[];
}

export interface DomainModel {
    organizations?: OrganizationModel[];
    contexts?: ContextModel[];
    modules?: ModuleModel[];
    definitions?: DefinitionGroups;
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

function isReference(value: unknown): value is Reference {
    return typeof value === 'object' && value !== null && '$refText' in value;
}

function isAstNode(value: unknown): value is AstNode {
    return typeof value === 'object' && value !== null && '$type' in value;
}

/** Recursively clean any value into a plain JSON-friendly form (no $-props). */
function cleanValue(value: unknown): unknown {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    if (Array.isArray(value)) {
        const arr = value.map(cleanValue).filter(v => v !== undefined);
        return arr.length > 0 ? arr : undefined;
    }
    if (isReference(value)) {
        return value.$refText;
    }
    if (ast.isFieldType(value)) {
        return typeToString(value);
    }
    if (ast.isDescription(value)) {
        return value.text;
    }
    if (ast.isDotPath(value)) {
        return dotPathToString(value);
    }
    if (ast.isLiteralValue(value)) {
        return literalScalar(value);
    }
    if (isAstNode(value)) {
        return cleanNode(value);
    }
    return undefined;
}

/** Resolve a literal node to its JS scalar (true/false, number, or string). */
function literalScalar(lit: ast.LiteralValue): string | number | boolean {
    if (ast.isBooleanLiteral(lit)) return lit.value === 'true';
    if (ast.isNumberLiteral(lit)) return Number(lit.value);
    return lit.value;
}

/** Clean a node to a plain object, dropping every `$`-prefixed property. */
function cleanNode(node: AstNode): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
        if (key.startsWith('$')) continue;
        const cleaned = cleanValue(value);
        if (cleaned !== undefined) result[key] = cleaned;
    }
    return result;
}

function typeToString(ft: ast.FieldType): string {
    if (ast.isPrimitiveType(ft)) return ft.value;
    if (ast.isCollectionType(ft)) {
        if (ft.kind === 'map' && ft.valueType) {
            return `Map<${typeToString(ft.elementType)}, ${typeToString(ft.valueType)}>`;
        }
        return `${ft.kind}<${typeToString(ft.elementType)}>`;
    }
    if (ast.isGenericType(ft)) {
        const inner = ft.valueType
            ? `${typeToString(ft.elementType)}, ${typeToString(ft.valueType)}`
            : typeToString(ft.elementType);
        return `${ft.typeName}<${inner}>`;
    }
    return ft.typeName;
}

function dotPathToString(dp: ast.DotPath): string {
    return dp.segments
        .map(seg => {
            const s = seg as unknown as Record<string, unknown>;
            return (s.name ?? s.segment ?? '') as string;
        })
        .filter(Boolean)
        .join('.');
}

function nameOf(value: unknown): string {
    if (typeof value === 'string') return value;
    if (isReference(value)) return value.$refText;
    return String(value);
}

function descOf(d?: ast.Description): string | undefined {
    return d?.text;
}

function metaOf(m?: ast.MetadataBlock): Record<string, unknown> | undefined {
    if (!m || m.entries.length === 0) return undefined;
    const out: Record<string, unknown> = {};
    for (const e of m.entries) {
        out[nameOf(e.key)] = cleanValue(e.value);
    }
    return out;
}

/** Drop undefined-valued keys so emitted JSON/YAML stays tidy. */
function compact<T extends object>(obj: T): T {
    const rec = obj as Record<string, unknown>;
    for (const k of Object.keys(rec)) {
        if (rec[k] === undefined) delete rec[k];
    }
    return obj;
}

// ---------------------------------------------------------------------------
// Fields and constraints
// ---------------------------------------------------------------------------

function constraintToString(c: ast.Constraint): string {
    const kind = c.kind ?? 'constraint';
    const arg =
        c.strValue ??
        c.numValue ??
        (c.value !== undefined ? String(literalScalar(c.value)) : undefined) ??
        (c.low !== undefined && c.high !== undefined ? `${c.low}..${c.high}` : undefined);
    return arg !== undefined ? `${kind}(${arg})` : kind;
}

function fieldOf(f: ast.FieldDecl): FieldModel {
    return compact({
        name: nameOf(f.name),
        type: typeToString(f.type),
        optional: f.optional || undefined,
        constraints: f.constraints.length > 0 ? f.constraints.map(constraintToString) : undefined,
    });
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

function collectEmits(clauses: AstNode[]): string[] {
    const emits: string[] = [];
    for (const c of clauses) {
        if (ast.isEmitsClause(c)) emits.push(nameOf(c.event));
        else if (ast.isForeachClause(c)) emits.push(...collectEmits(c.body));
    }
    return emits;
}

function summarizeOperation(op: AstNode): OperationModel {
    const o = op as unknown as Record<string, unknown>;
    const model: OperationModel = { name: '' };

    if (ast.isCommandTriggeredOp(op)) {
        model.name = op.label;
        model.trigger = { command: nameOf(op.command) };
        model.emits = collectEmits(op.clauses);
        model.description = descOf(op.description);
        model.satisfies = op.satisfies?.ids;
        model.detail = op.clauses.map(cleanValue).filter(v => v !== undefined);
    } else if (ast.isEventTriggeredOp(op)) {
        model.name = op.label;
        model.trigger = { event: nameOf(op.event), command: nameOf(op.command) };
        model.emits = collectEmits(op.clauses);
        model.description = descOf(op.description);
        model.satisfies = op.satisfies?.ids;
        model.detail = op.clauses.map(cleanValue).filter(v => v !== undefined);
    } else if (ast.isInternalOp(op)) {
        model.name = nameOf(op.name);
        model.returns = op.returnType ? typeToString(op.returnType) : undefined;
        model.emits = collectEmits(op.clauses);
        model.description = descOf(op.description);
        model.satisfies = op.satisfies?.ids;
        model.detail = op.clauses.map(cleanValue).filter(v => v !== undefined);
    } else if (ast.isNamedOperationDef(op)) {
        model.name = op.name;
        const emits: string[] = [];
        const accepts: string[] = [];
        for (const item of op.items) {
            if (ast.isEmitsClause(item)) emits.push(nameOf(item.event));
            else if (ast.isAcceptsClause(item)) {
                const params = [item.first, ...item.more];
                for (const p of params) accepts.push(`${nameOf(p.name)} : ${typeToString(p.type)}`);
            } else if (ast.isReturnsDecl(item)) {
                model.returns = typeToString(item.type.type);
            } else if (ast.isOnClause(item)) {
                model.on = nameOf(item.type);
            } else if (ast.isDescription(item)) {
                model.description = item.text;
            } else if (ast.isSatisfiesDecl(item)) {
                model.satisfies = item.ids;
            }
        }
        if (emits.length) model.emits = emits;
        if (accepts.length) model.accepts = accepts;
    } else {
        // Unknown operation shape — keep it whole.
        model.name = (o.label as string) ?? (o.name as string) ?? 'operation';
        model.detail = [cleanNode(op)];
    }

    if (model.emits && model.emits.length === 0) model.emits = undefined;
    if (model.detail && model.detail.length === 0) model.detail = undefined;
    return compact(model);
}

// ---------------------------------------------------------------------------
// Body walker — buckets the polymorphic bodyItems/items arrays
// ---------------------------------------------------------------------------

interface BodyBuckets {
    satisfies?: string[];
    fields?: FieldModel[];
    identity?: { name: string; type: string };
    references?: { name: string; target: string; cardinality: string }[];
    operations?: OperationModel[];
    invariants?: unknown[];
    policies?: unknown[];
    stateMachines?: unknown[];
    transitions?: unknown[];
    interfaces?: ConstructModel[];
    exposes?: string[];
    returns?: string;
    eventKind?: string;
    schedule?: string;
    guard?: unknown;
    other?: unknown[];
}

function walkBody(items: AstNode[]): BodyBuckets {
    const b: BodyBuckets = {};
    const satisfies: string[] = [];
    const fields: FieldModel[] = [];
    const references: { name: string; target: string; cardinality: string }[] = [];
    const operations: OperationModel[] = [];
    const invariants: unknown[] = [];
    const policies: unknown[] = [];
    const stateMachines: unknown[] = [];
    const transitions: unknown[] = [];
    const interfaces: ConstructModel[] = [];
    const exposes: string[] = [];
    const other: unknown[] = [];

    for (const item of items) {
        if (ast.isSatisfiesDecl(item)) {
            satisfies.push(...item.ids);
        } else if (ast.isFieldDecl(item)) {
            fields.push(fieldOf(item));
        } else if (ast.isFieldsBlock(item)) {
            for (const f of item.fields) fields.push(fieldOf(f));
        } else if (ast.isIdentityDecl(item)) {
            b.identity = { name: nameOf(item.name), type: typeToString(item.type) };
        } else if (ast.isReferencesBlock(item)) {
            for (const r of item.refs) {
                references.push({ name: nameOf(r.name), target: nameOf(r.target), cardinality: r.cardinality });
            }
        } else if (ast.isOperationsBlock(item)) {
            for (const op of item.ops) operations.push(summarizeOperation(op));
        } else if (ast.isNamedOperationDef(item)) {
            operations.push(summarizeOperation(item));
        } else if (ast.isInvariantsBlock(item)) {
            for (const inv of item.invariants) invariants.push(cleanNode(inv));
        } else if (ast.isInlineInvariant(item)) {
            invariants.push(cleanNode(item));
        } else if (ast.isPoliciesBlock(item)) {
            for (const p of item.policies) policies.push(cleanNode(p));
        } else if (ast.isStatesBlock(item)) {
            for (const m of item.machines) stateMachines.push(cleanNode(m));
        } else if (ast.isTransitionsBlock(item)) {
            for (const t of item.transitions) transitions.push(cleanNode(t));
        } else if (ast.isInterfaceDef(item)) {
            interfaces.push(normalizeInterface(item));
        } else if (ast.isExposesClause(item)) {
            exposes.push(dotPathToString(item.path));
        } else if (ast.isReturnsDecl(item)) {
            b.returns = typeToString(item.type.type);
        } else if (ast.isEventTypeClassifier(item)) {
            b.eventKind = item.classifier;
        } else if (ast.isEventSchedule(item)) {
            b.schedule = item.expr;
        } else if (ast.isEventGuard(item)) {
            b.guard = cleanValue(item.expr);
        } else if (ast.isDescription(item) || ast.isMetadataBlock(item)) {
            // handled at the definition level — skip
        } else {
            other.push(cleanNode(item));
        }
    }

    if (satisfies.length) b.satisfies = satisfies;
    if (fields.length) b.fields = fields;
    if (references.length) b.references = references;
    if (operations.length) b.operations = operations;
    if (invariants.length) b.invariants = invariants;
    if (policies.length) b.policies = policies;
    if (stateMachines.length) b.stateMachines = stateMachines;
    if (transitions.length) b.transitions = transitions;
    if (interfaces.length) b.interfaces = interfaces;
    if (exposes.length) b.exposes = exposes;
    if (other.length) b.other = other;
    return b;
}

function normalizeInterface(def: ast.InterfaceDef): ConstructModel {
    const operations: OperationModel[] = [];
    const exposes: string[] = [];
    for (const m of def.members) {
        if (ast.isNamedOperationDef(m)) operations.push(summarizeOperation(m));
        else if (ast.isExposesClause(m)) exposes.push(dotPathToString(m.path));
    }
    return compact({
        kind: 'interface',
        name: nameOf(def.name),
        description: descOf(def.description),
        metadata: metaOf(def.metadata),
        operations: operations.length ? operations : undefined,
        exposes: exposes.length ? exposes : undefined,
    }) as ConstructModel;
}

// ---------------------------------------------------------------------------
// Definition normalization
// ---------------------------------------------------------------------------

interface KindSpec {
    kind: string;
    group: string;
}

const KIND_BY_TYPE: Record<string, KindSpec> = {
    EntityDef: { kind: 'entity', group: 'entities' },
    AggregateDef: { kind: 'aggregate', group: 'aggregates' },
    ValueDef: { kind: 'value', group: 'values' },
    EnumDef: { kind: 'enum', group: 'enums' },
    CommandDef: { kind: 'command', group: 'commands' },
    QueryDef: { kind: 'query', group: 'queries' },
    EventDef: { kind: 'event', group: 'events' },
    ExternalEventDef: { kind: 'event', group: 'events' },
    ErrorEventDef: { kind: 'event', group: 'events' },
    TemporalEventDef: { kind: 'event', group: 'events' },
    DomainServiceDef: { kind: 'domain-service', group: 'services' },
    ApplicationServiceDef: { kind: 'application-service', group: 'services' },
    InfrastructureServiceDef: { kind: 'infrastructure-service', group: 'services' },
    ServiceDef: { kind: 'service', group: 'services' },
    PolicyDef: { kind: 'policy', group: 'policies' },
    ScopedPolicyDef: { kind: 'policy', group: 'policies' },
    ReactionDef: { kind: 'reaction', group: 'reactions' },
    InvariantDef: { kind: 'invariant', group: 'invariants' },
    AgreementDef: { kind: 'agreement', group: 'agreements' },
    StatemachineDef: { kind: 'statemachine', group: 'statemachines' },
};

function normalizeDefinition(def: AstNode): { group: string; construct: ConstructModel } {
    const spec = KIND_BY_TYPE[def.$type] ?? { kind: def.$type, group: 'other' };
    const d = def as unknown as Record<string, unknown>;

    const base: ConstructModel = {
        kind: spec.kind,
        name: nameOf(d.name),
        description: descOf(d.description as ast.Description | undefined),
        metadata: metaOf(d.metadata as ast.MetadataBlock | undefined),
    };
    // satisfies as a direct property (enum/policy/external-event/invariant/...)
    if (d.satisfies && ast.isSatisfiesDecl(d.satisfies as AstNode)) {
        base.satisfies = (d.satisfies as ast.SatisfiesDecl).ids;
    }

    // Body-bearing definitions: satisfies lives inside bodyItems instead.
    const bodyItems = (d.bodyItems ?? d.items) as AstNode[] | undefined;
    if (Array.isArray(bodyItems)) {
        const buckets = walkBody(bodyItems);
        const inheritedSatisfies = buckets.satisfies;
        delete buckets.satisfies;
        Object.assign(base, buckets);
        base.satisfies ??= inheritedSatisfies;
    }

    // Per-kind extras not covered by the generic body walk
    if (ast.isEnumDef(def)) {
        base.values = def.values.map(v => nameOf(v.value));
    } else if (ast.isAggregateDef(def)) {
        for (const it of def.bodyItems) {
            if (ast.isAggregateRootDecl(it)) base.root = nameOf(it.root);
            else if (ast.isAggregateEntitiesDecl(it)) base.entities = it.entities.map(nameOf);
            else if (ast.isAggregateContainsDecl(it)) base.contains = [nameOf(it.first), ...it.more.map(nameOf)];
        }
    } else if (ast.isPolicyDef(def)) {
        base.triggers = def.triggers.map(nameOf);
        base.effect = nameOf(def.effect);
        base.guard = def.guard ? cleanValue(def.guard) : undefined;
    } else if (ast.isExternalEventDef(def)) {
        base.eventKind = 'external';
        base.from = nameOf(def.from);
        base.consumes = [nameOf(def.first), ...def.more.map(nameOf)];
    } else if (ast.isErrorEventDef(def)) {
        base.eventKind = base.eventKind ?? 'error';
    } else if (ast.isInvariantDef(def)) {
        base.enforcement = def.enforcement ?? undefined;
        base.message = def.message ?? undefined;
        base.on = def.on ? nameOf(def.on.type) : undefined;
        base.must = def.must ? cleanValue(def.must.expr) : undefined;
    } else if (ast.isStatemachineDef(def)) {
        base.states = def.items.map(cleanValue).filter(v => v !== undefined);
    } else if (ast.isReactionDef(def)) {
        const triggers: string[] = [];
        const effects: string[] = [];
        for (const it of def.items) {
            if (ast.isTriggeredByClause(it)) triggers.push(nameOf(it.event));
            else if (ast.isEffectsClause(it)) effects.push(nameOf(it.command));
        }
        if (triggers.length) base.triggers = triggers;
        if (effects.length) base.effects = effects;
        delete (base as Record<string, unknown>).other;
    }

    return { group: spec.group, construct: compact(base) as ConstructModel };
}

function groupDefinitions(defs: AstNode[]): DefinitionGroups | undefined {
    const groups: DefinitionGroups = {};
    for (const def of defs) {
        const { group, construct } = normalizeDefinition(def);
        (groups[group] ??= []).push(construct);
    }
    return Object.keys(groups).length > 0 ? groups : undefined;
}

// ---------------------------------------------------------------------------
// Container normalization (organization / context / module)
// ---------------------------------------------------------------------------

function normalizeModule(mod: ast.ModuleDef): ModuleModel {
    const members = mod.body?.members ?? [];
    const subModules = members.filter(ast.isModuleDef);
    const defs = members.filter((m): m is ast.Definition | ast.InterfaceDef => !ast.isModuleDef(m));
    const dependencies = [
        ...mod.usesDecls.map(u => nameOf(u.module)),
        ...(mod.body?.dependsBlock?.deps.map(nameOf) ?? []),
    ];
    return compact({
        name: nameOf(mod.name),
        description: descOf(mod.description),
        metadata: metaOf(mod.metadata),
        dependencies: dependencies.length ? dependencies : undefined,
        modules: subModules.length ? subModules.map(normalizeModule) : undefined,
        definitions: groupDefinitions(defs),
    });
}

function normalizeRelations(map?: ast.ContextMapBlock): RelationModel[] | undefined {
    if (!map || map.relations.length === 0) return undefined;
    return map.relations.map(r => {
        const direction = ast.isUpstreamRelation(r)
            ? 'upstream'
            : ast.isDownstreamRelation(r)
              ? 'downstream'
              : 'symmetric';
        return { direction, pattern: (r as { pattern: string }).pattern, target: nameOf(r.target) };
    });
}

function normalizeContext(ctx: ast.ContextDef): ContextModel {
    const modules = ctx.members.filter(ast.isModuleDef);
    const defs = ctx.members.filter((m): m is ast.Definition => !ast.isModuleDef(m));
    return compact({
        name: nameOf(ctx.name),
        shortname: ctx.shortname ? nameOf(ctx.shortname.value) : undefined,
        description: descOf(ctx.description),
        metadata: metaOf(ctx.metadata),
        contextMap: normalizeRelations(ctx.contextMap),
        modules: modules.length ? modules.map(normalizeModule) : undefined,
        definitions: groupDefinitions(defs),
    });
}

function normalizeOrganization(org: ast.OrganizationDef): OrganizationModel {
    return compact({
        name: nameOf(org.name),
        description: descOf(org.description),
        metadata: metaOf(org.metadata),
        contexts: org.contexts.length ? org.contexts.map(normalizeContext) : undefined,
    });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function normalizeDomain(file: ast.DomainFile): DomainModel {
    const organizations: OrganizationModel[] = [];
    const contexts: ContextModel[] = [];
    const modules: ModuleModel[] = [];
    const looseDefs: AstNode[] = [];

    for (const el of file.elements) {
        if (ast.isOrganizationDef(el)) organizations.push(normalizeOrganization(el));
        else if (ast.isContextDef(el)) contexts.push(normalizeContext(el));
        else if (ast.isModuleDef(el)) modules.push(normalizeModule(el));
        else looseDefs.push(el);
    }

    return compact({
        organizations: organizations.length ? organizations : undefined,
        contexts: contexts.length ? contexts : undefined,
        modules: modules.length ? modules : undefined,
        definitions: groupDefinitions(looseDefs),
    });
}
