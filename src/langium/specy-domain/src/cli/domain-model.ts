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
 * The grammar gives every definition TYPED SLOTS (identity=, fields=, operations=)
 * rather than one polymorphic bodyItems array, so each kind is projected directly.
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
    description?: string;
    satisfies?: string[];
}

export interface OperationModel {
    name: string;
    description?: string;
    satisfies?: string[];
    /** Triggering command for command-triggered operations. */
    on?: string;
    trigger?: { command?: string };
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

function typeToString(ft: ast.FieldType | undefined): string {
    // The AST may be partial (error recovery), so a type node can be missing.
    if (!ft) return 'unknown';
    if (ast.isPrimitiveType(ft)) return ft.value;
    if (ast.isCollectionType(ft)) {
        if (ft.kind === 'map' && ft.valueType) {
            return `map<${typeToString(ft.elementType)}, ${typeToString(ft.valueType)}>`;
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

function dotPathToString(dp: ast.DotPath | undefined): string {
    return (dp?.segments ?? [])
        .map(seg => seg.value)
        .filter(Boolean)
        .join('.');
}

function nameOf(value: unknown): string {
    if (value === undefined || value === null) return '';
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

function satisfiesOf(s?: ast.SatisfiesDecl): string[] | undefined {
    return s && s.ids.length > 0 ? s.ids : undefined;
}

/** Drop undefined-valued keys so emitted JSON/YAML stays tidy. */
function compact<T extends object>(obj: T): T {
    const rec = obj as Record<string, unknown>;
    for (const k of Object.keys(rec)) {
        if (rec[k] === undefined) delete rec[k];
    }
    return obj;
}

function nonEmpty<T>(arr: T[]): T[] | undefined {
    return arr.length > 0 ? arr : undefined;
}

// ---------------------------------------------------------------------------
// Fields, references, constraints
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
        constraints: nonEmpty(f.constraints.map(constraintToString)),
        description: descOf(f.description),
        satisfies: satisfiesOf(f.satisfies),
    });
}

function fieldsOf(block?: ast.FieldsBlock): FieldModel[] | undefined {
    return block ? nonEmpty(block.fields.map(fieldOf)) : undefined;
}

function referencesOf(block?: ast.ReferencesBlock) {
    if (!block) return undefined;
    return nonEmpty(
        block.refs.map(r =>
            compact({
                name: nameOf(r.name),
                target: nameOf(r.target),
                cardinality: r.cardinality,
                description: descOf(r.description),
            }),
        ),
    );
}

function identityOf(id?: ast.IdentityDecl) {
    return id ? { name: nameOf(id.name), type: typeToString(id.type) } : undefined;
}

function paramsOf(list?: ast.ParamList): string[] | undefined {
    if (!list) return undefined;
    return nonEmpty(list.params.map(p => `${nameOf(p.name)} : ${typeToString(p.type)}${p.optional ? '?' : ''}`));
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/** `emits` is the concrete syntax of an event's 1..1 "raised by" relation. */
function collectEmits(clauses: ast.OperationClause[]): string[] {
    const emits: string[] = [];
    for (const c of clauses) {
        if (ast.isEmitsClause(c)) emits.push(nameOf(c.event));
        else if (ast.isForeachClause(c)) emits.push(...collectEmits(c.body));
    }
    return emits;
}

function bodyToModel(body: ast.OperationBody | undefined, model: OperationModel): void {
    if (!body) return;
    model.satisfies = satisfiesOf(body.satisfies);
    model.safety = body.safety ?? undefined;
    model.idempotent = body.idempotent || undefined;
    model.emits = nonEmpty(collectEmits(body.clauses));
    model.detail = nonEmpty(body.clauses.map(cleanValue).filter(v => v !== undefined));
}

function summarizeOperation(op: ast.OperationDef): OperationModel {
    const model: OperationModel = { name: '' };

    if (ast.isCommandTriggeredOp(op)) {
        model.name = op.label;
        model.on = nameOf(op.command);
        model.trigger = { command: nameOf(op.command) };
        model.description = descOf(op.description);
        bodyToModel(op.body, model);
    } else {
        model.name = nameOf(op.name);
        model.accepts = paramsOf(op.params);
        model.returns = op.returnType ? typeToString(op.returnType) : undefined;
        model.description = descOf(op.description);
        bodyToModel(op.body, model);
    }

    return compact(model);
}

function operationsOf(block?: ast.OperationsBlock): OperationModel[] | undefined {
    return block ? nonEmpty(block.ops.map(summarizeOperation)) : undefined;
}

/** A signature-only operation: interface members, infra services, repositories. */
function summarizeSignature(op: ast.OperationSignature): OperationModel {
    return compact({
        name: nameOf(op.name),
        accepts: paramsOf(op.params),
        returns: op.returnType ? typeToString(op.returnType) : undefined,
        description: descOf(op.description),
        satisfies: satisfiesOf(op.satisfies),
        detail: nonEmpty(op.conditions.map(cleanValue).filter(v => v !== undefined)),
    });
}

function summarizeValueOp(op: ast.ValueOpDef): OperationModel {
    const model: OperationModel = {
        name: nameOf(op.name),
        accepts: paramsOf(op.params),
        returns: typeToString(op.returnType),
        description: descOf(op.description),
    };
    bodyToModel(op.body, model);
    return compact(model);
}

/** Read-only entities admit only safe operations — no sets / creates / emits. */
function summarizeSafeOp(op: ast.SafeOpDef): OperationModel {
    return compact({
        name: nameOf(op.name),
        accepts: paramsOf(op.params),
        returns: op.returnType ? typeToString(op.returnType) : undefined,
        description: descOf(op.description),
        satisfies: satisfiesOf(op.satisfies),
        safety: op.safe ? 'safe' : undefined,
        detail: nonEmpty(op.clauses.map(cleanValue).filter(v => v !== undefined)),
    });
}

// ---------------------------------------------------------------------------
// Invariants, states
// ---------------------------------------------------------------------------

function enforcementToString(e?: ast.EnforcementStrategy): string | undefined {
    if (!e) return undefined;
    return e.kind === 'compensation' && e.type ? `compensation(${nameOf(e.type)})` : e.kind;
}

function invariantsOf(block?: ast.InvariantsBlock) {
    if (!block) return undefined;
    return nonEmpty(
        block.invariants.map(inv =>
            compact({
                name: nameOf(inv.name),
                description: descOf(inv.description),
                satisfies: satisfiesOf(inv.satisfies),
                params: paramsOf(inv.params),
                expression: cleanValue(inv.expr),
                enforcement: enforcementToString(inv.enforcement),
            }),
        ),
    );
}

function statesOf(block?: ast.StatesBlock) {
    if (!block) return undefined;
    return nonEmpty(
        block.machines.map(m =>
            compact({
                name: nameOf(m.name),
                description: descOf(m.description),
                satisfies: satisfiesOf(m.satisfies),
                states: nonEmpty(
                    m.members.filter(ast.isStateDef).map(s =>
                        compact({
                            name: nameOf(s.name),
                            kind: s.kind,
                            description: descOf(s.description),
                            invariants: invariantsOf(s.invariants),
                        }),
                    ),
                ),
                transitions: nonEmpty(
                    m.members.filter(ast.isTransitionDef).map(t =>
                        compact({
                            from: nameOf(t.source),
                            to: nameOf(t.target),
                            on: nameOf(t.trigger),
                            description: descOf(t.description),
                            satisfies: satisfiesOf(t.satisfies),
                            conditions: nonEmpty(t.conditions.map(cleanValue).filter(v => v !== undefined)),
                        }),
                    ),
                ),
            }),
        ),
    );
}

// ---------------------------------------------------------------------------
// Interface — a port. The role is the discriminator.
// ---------------------------------------------------------------------------

function normalizeInterface(def: ast.InterfaceDef): ConstructModel {
    const exposes: string[] = [];
    const operations: OperationModel[] = [];
    let describes: string | undefined;

    for (const m of def.members) {
        if (ast.isExposesClause(m)) exposes.push(dotPathToString(m.path));
        else if (ast.isDescribesClause(m)) describes = nameOf(m.provider);
        else operations.push(summarizeSignature(m));
    }

    return compact({
        kind: 'interface',
        // api = driving port (the domain is called); spi = driven port (the domain calls out).
        role: def.role,
        name: nameOf(def.name),
        description: descOf(def.description),
        metadata: metaOf(def.metadata),
        satisfies: satisfiesOf(def.satisfies),
        // API selects operations that already exist; SPI defines the contract a
        // provider must fulfil.
        exposes: nonEmpty(exposes),
        describes,
        operations: nonEmpty(operations),
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
    ReadOnlyEntityDef: { kind: 'read-only-entity', group: 'entities' },
    AggregateDef: { kind: 'aggregate', group: 'aggregates' },
    ValueDef: { kind: 'value', group: 'values' },
    EnumDef: { kind: 'enum', group: 'enums' },
    CommandDef: { kind: 'command', group: 'commands' },
    QueryDef: { kind: 'query', group: 'queries' },
    EventDef: { kind: 'event', group: 'events' },
    ExternalEventDef: { kind: 'external-event', group: 'events' },
    ErrorEventDef: { kind: 'error-event', group: 'events' },
    TemporalEventDef: { kind: 'temporal-event', group: 'events' },
    DomainServiceDef: { kind: 'domain-service', group: 'services' },
    ApplicationServiceDef: { kind: 'application-service', group: 'services' },
    InfrastructureServiceDef: { kind: 'infrastructure-service', group: 'services' },
    RepositoryDef: { kind: 'repository', group: 'repositories' },
    InterfaceDef: { kind: 'interface', group: 'interfaces' },
    ReactionDef: { kind: 'reaction', group: 'reactions' },
    InvariantDef: { kind: 'invariant', group: 'invariants' },
    AgreementDef: { kind: 'agreement', group: 'agreements' },
};

function normalizeDefinition(def: ast.Definition): { group: string; construct: ConstructModel } {
    const spec = KIND_BY_TYPE[def.$type] ?? { kind: def.$type, group: 'other' };
    const d = def as unknown as Record<string, unknown>;

    const base: ConstructModel = {
        kind: spec.kind,
        name: nameOf(d.name),
        description: descOf(d.description as ast.Description | undefined),
        metadata: metaOf(d.metadata as ast.MetadataBlock | undefined),
        satisfies: satisfiesOf(d.satisfies as ast.SatisfiesDecl | undefined),
    };

    if (ast.isEnumDef(def)) {
        // `of ValueType` — the enum holds instances of a value type, which must
        // then declare a `code` field.
        base.valueType = def.valueType ? nameOf(def.valueType) : undefined;
        base.values = def.values.map(v =>
            compact({
                name: nameOf(v.name),
                value: v.value ? literalScalar(v.value) : undefined,
                description: descOf(v.description),
            }),
        );
    } else if (ast.isValueDef(def)) {
        base.fields = fieldsOf(def.fields);
        base.operations = nonEmpty((def.operations?.ops ?? []).map(summarizeValueOp));
        base.invariants = invariantsOf(def.invariants);
    } else if (ast.isEntityDef(def)) {
        base.identity = identityOf(def.identity);
        base.duplicateDetection = def.duplicateDetection ? cleanValue(def.duplicateDetection.expr) : undefined;
        base.fields = fieldsOf(def.fields);
        base.references = referencesOf(def.references);
        base.operations = operationsOf(def.operations);
        base.stateMachines = statesOf(def.states);
        base.invariants = invariantsOf(def.invariants);
    } else if (ast.isReadOnlyEntityDef(def)) {
        // Master data: state owned upstream. Observable here, not mutable here.
        base.sourcedFrom = nameOf(def.sourcedFrom.source);
        base.syncedVia = def.syncedVia?.pattern;
        base.projectedBy = def.projectedBy ? nameOf(def.projectedBy.adapter) : undefined;
        base.identity = identityOf(def.identity);
        base.fields = fieldsOf(def.fields);
        base.references = referencesOf(def.references);
        base.operations = nonEmpty((def.operations?.ops ?? []).map(summarizeSafeOp));
        base.invariants = invariantsOf(def.invariants);
    } else if (ast.isAggregateDef(def)) {
        // The aggregate IS its root; `entities` lists the non-root children.
        base.identity = identityOf(def.identity);
        base.duplicateDetection = def.duplicateDetection ? cleanValue(def.duplicateDetection.expr) : undefined;
        base.fields = fieldsOf(def.fields);
        base.entities = def.entities.entities.map(nameOf);
        base.references = referencesOf(def.references);
        base.operations = operationsOf(def.operations);
        base.stateMachines = statesOf(def.states);
        base.invariants = invariantsOf(def.invariants);
    } else if (ast.isCommandDef(def)) {
        // A command always carries an identifier — the correlation id.
        base.identity = identityOf(def.identity);
        base.fields = fieldsOf(def.fields);
    } else if (ast.isQueryDef(def)) {
        base.readsFrom = nameOf(def.readsFrom.repository);
        base.fields = fieldsOf(def.fields);
        base.returns = typeToString(def.returnType);
    } else if (ast.isEventDef(def) || ast.isErrorEventDef(def)) {
        base.about = def.about ? nameOf(def.about.entity) : undefined;
        base.causedBy = def.causedBy ? nameOf(def.causedBy.cause) : undefined;
        base.fields = fieldsOf(def.fields);
    } else if (ast.isExternalEventDef(def)) {
        // Consumed through a reaction, never straight into a command.
        base.from = nameOf(def.source);
        base.about = def.about ? nameOf(def.about.entity) : undefined;
        base.fields = fieldsOf(def.fields);
    } else if (ast.isTemporalEventDef(def)) {
        base.about = def.about ? nameOf(def.about.entity) : undefined;
        base.anchor = anchorOf(def.anchor);
        base.guard = def.guard ? cleanValue(def.guard.expr) : undefined;
        base.fields = fieldsOf(def.fields);
    } else if (ast.isDomainServiceDef(def)) {
        base.calls = def.calls ? def.calls.services.map(nameOf) : undefined;
        base.operations = operationsOf(def.operations);
    } else if (ast.isApplicationServiceDef(def)) {
        base.exposedBy = def.exposedBy ? nameOf(def.exposedBy.interface) : undefined;
        base.operations = operationsOf(def.operations);
    } else if (ast.isInfrastructureServiceDef(def)) {
        base.describedBy = def.describedBy ? nameOf(def.describedBy.interface) : undefined;
        base.operations = nonEmpty(def.operations.ops.map(summarizeSignature));
    } else if (ast.isRepositoryDef(def)) {
        base.for = nameOf(def.entity);
        base.readOnly = def.readOnly || undefined;
        base.describedBy = def.describedBy ? nameOf(def.describedBy.interface) : undefined;
        base.operations = nonEmpty(def.ops.map(summarizeSignature));
    } else if (ast.isInterfaceDef(def)) {
        return { group: spec.group, construct: normalizeInterface(def) };
    } else if (ast.isReactionDef(def)) {
        // The sole event -> command edge, uniform across all four event types.
        base.triggeredBy = def.triggeredBy.events.map(nameOf);
        base.guard = def.guard ? cleanValue(def.guard.expr) : undefined;
        base.effects = nameOf(def.effects.command);
    } else if (ast.isInvariantDef(def)) {
        base.on = dotPathToString(def.scope);
        base.must = cleanValue(def.must.expr);
        base.enforcement = enforcementToString(def.enforcement);
    } else if (ast.isAgreementDef(def)) {
        base.participants = def.participants.participants.map(nameOf);
        base.predicate = cleanValue(def.predicate.expr);
        base.reconciliation = reconciliationOf(def.reconciliation);
    }

    return { group: spec.group, construct: compact(base) as ConstructModel };
}

function anchorOf(a: ast.TemporalAnchor): Record<string, unknown> {
    if (ast.isRelativeAnchor(a)) {
        return compact({ kind: 'relative', reference: nameOf(a.event), offset: cleanValue(a.offset) });
    }
    if (ast.isAbsoluteAnchor(a)) {
        return { kind: 'absolute', instant: dotPathToString(a.instant) };
    }
    return { kind: 'recurring', schedule: a.schedule };
}

function reconciliationOf(r: ast.ReconciliationDef): Record<string, unknown> {
    const trigger = r.trigger.schedule
        ? { schedule: r.trigger.schedule }
        : { events: r.trigger.events.map(nameOf) };
    return compact({
        name: nameOf(r.name),
        description: descOf(r.description),
        satisfies: satisfiesOf(r.satisfies),
        trigger,
        detection: r.detection,
        compensation: r.compensation.commands.map(nameOf),
        coordination: r.coordination ?? undefined,
        // The chain must terminate: the final action is alert / suspend / manual.
        escalation: r.escalation
            ? nonEmpty(
                  r.escalation.steps.map(s =>
                      compact({
                          name: nameOf(s.name),
                          description: descOf(s.description),
                          when: cleanValue(s.when),
                          action: cleanValue(s.action),
                      }),
                  ),
              )
            : undefined,
    });
}

function groupDefinitions(defs: ast.Definition[]): DefinitionGroups | undefined {
    const groups: DefinitionGroups = {};
    for (const def of defs) {
        if (!def || typeof def.$type !== 'string') continue;
        // Isolate each definition: a malformed node from a partial/recovered AST
        // degrades to a placeholder instead of aborting the whole serialization.
        try {
            const { group, construct } = normalizeDefinition(def);
            (groups[group] ??= []).push(construct);
        } catch {
            const d = def as unknown as Record<string, unknown>;
            (groups.other ??= []).push({
                kind: def.$type,
                name: nameOf(d.name),
                _unparsed: true,
            });
        }
    }
    return Object.keys(groups).length > 0 ? groups : undefined;
}

// ---------------------------------------------------------------------------
// Container normalization (organization / context / module)
// ---------------------------------------------------------------------------

function normalizeModule(mod: ast.ModuleDef): ModuleModel {
    return compact({
        name: nameOf(mod.name),
        description: descOf(mod.description),
        metadata: metaOf(mod.metadata),
        satisfies: satisfiesOf(mod.satisfies),
        // The two interface relations are NOT symmetric: `exposes` is the public
        // surface; `requires` is what the module needs given to it.
        exposes: mod.exposes ? nonEmpty(mod.exposes.interfaces.map(nameOf)) : undefined,
        requires: mod.requires ? nonEmpty(mod.requires.interfaces.map(nameOf)) : undefined,
        dependencies: mod.dependsOn ? nonEmpty(mod.dependsOn.modules.map(nameOf)) : undefined,
        definitions: groupDefinitions(mod.members),
    }) as ModuleModel;
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
        satisfies: satisfiesOf(ctx.satisfies),
        requirementsSource: ctx.requirementsSource?.path,
        contextMap: normalizeRelations(ctx.contextMap),
        modules: nonEmpty(modules.map(normalizeModule)),
        definitions: groupDefinitions(defs),
    }) as ContextModel;
}

function normalizeOrganization(org: ast.OrganizationDef): OrganizationModel {
    return compact({
        name: nameOf(org.name),
        description: descOf(org.description),
        metadata: metaOf(org.metadata),
        satisfies: satisfiesOf(org.satisfies),
        requirementsSource: org.requirementsSource?.path,
        contexts: nonEmpty(org.contexts.map(normalizeContext)),
    }) as OrganizationModel;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function normalizeDomain(file: ast.DomainFile): DomainModel {
    const organizations: OrganizationModel[] = [];
    const contexts: ContextModel[] = [];
    const modules: ModuleModel[] = [];
    const looseDefs: ast.Definition[] = [];

    for (const el of file.elements) {
        if (ast.isOrganizationDef(el)) organizations.push(normalizeOrganization(el));
        else if (ast.isContextDef(el)) contexts.push(normalizeContext(el));
        else if (ast.isModuleDef(el)) modules.push(normalizeModule(el));
        else looseDefs.push(el);
    }

    return compact({
        organizations: nonEmpty(organizations),
        contexts: nonEmpty(contexts),
        modules: nonEmpty(modules),
        definitions: groupDefinitions(looseDefs),
    });
}
