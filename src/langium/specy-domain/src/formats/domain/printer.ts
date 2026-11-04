/**
 * DSL printer for the clean domain model: the inverse of the normalizer
 * (cli/domain-model.ts). `printDomain(model)` writes a `.domain` text that the
 * parser reads back into the same model — the round-trip the tests pin for
 * every example file.
 *
 * Grouping is the normalizer's (definitions grouped by kind under their
 * container), so a file printed from its own model comes back in canonical
 * order: comments gone, definitions grouped, one house style. The exported
 * block printers (operations, states, invariants, …) also write the DSL
 * islands of the Markdown encoding.
 */
import type { ConstructModel, ContextModel, DefinitionGroups, DomainModel, FieldModel, ModuleModel, OperationModel, OrganizationModel } from '../../cli/domain-model.js';
import { IndentWriter, describe, identOrString, isTypeName, literal, metaBlock, nameOrString, quote, satisfiesLine } from '../kit/dsl.js';
import { printArgs, printExpression, printLiteral } from './expressions.js';

type Rec = Record<string, unknown>;

/** The printing order of the normalizer's groups. */
export const GROUP_ORDER = ['enums', 'values', 'entities', 'aggregates', 'commands', 'queries', 'events', 'services', 'repositories', 'interfaces', 'reactions', 'invariants', 'agreements', 'other'];

export function printDomain(model: DomainModel): string {
    const w = new IndentWriter('  ');
    for (const org of model.organizations ?? []) printOrganization(w, org);
    for (const ctx of model.contexts ?? []) printContext(w, ctx);
    for (const mod of model.modules ?? []) printModule(w, mod);
    if (model.definitions) printGroups(w, model.definitions);
    return w.toString();
}

// ---------------------------------------------------------------------------
// Containers
// ---------------------------------------------------------------------------

function head(keyword: string, name: string, c: { description?: string; metadata?: Record<string, unknown> }, extra = ''): string {
    return `${keyword} ${name}${extra}${describe(c.description)}${metaHead(c.metadata)}`;
}

function metaHead(metadata: Record<string, unknown> | undefined): string {
    if (!metadata || !Object.keys(metadata).length) return '';
    return ` meta { ${Object.entries(metadata)
        .map(([k, v]) => `${k} = ${literal(v)}`)
        .join(' ')} }`;
}

function printOrganization(w: IndentWriter, org: OrganizationModel): void {
    const o = org as OrganizationModel & { satisfies?: string[] };
    w.block(head('organization', org.name, org), () => {
        satisfiesLine(w, o.satisfies);
        if (org.requirementsSource) w.line(`requirements-source ${quote(org.requirementsSource)}`);
        for (const s of org.subdomains ?? []) {
            w.line(`subdomain ${s.name} ${s.classification}${describe(s.description)}${metaHead(s.metadata)}`);
        }
        for (const ctx of org.contexts ?? []) {
            w.blank();
            printContext(w, ctx);
        }
    });
    w.blank();
}

function printContext(w: IndentWriter, ctx: ContextModel): void {
    const c = ctx as ContextModel & { satisfies?: string[] };
    w.block(head('context', ctx.name, ctx, ctx.shortname ? ` (${ctx.shortname})` : ''), () => {
        satisfiesLine(w, c.satisfies);
        if (ctx.requirementsSource) w.line(`requirements-source ${quote(ctx.requirementsSource)}`);
        if (ctx.models?.length) w.line(`models ${ctx.models.join(', ')}`);
        if (ctx.contextMap?.length) {
            w.block('map', () => {
                for (const r of ctx.contextMap!) w.line(`${r.direction} ${r.target} : ${r.pattern}`);
            });
        }
        for (const mod of ctx.modules ?? []) {
            w.blank();
            printModule(w, mod);
        }
        if (ctx.definitions) {
            w.blank();
            printGroups(w, ctx.definitions);
        }
    });
    w.blank();
}

function printModule(w: IndentWriter, mod: ModuleModel): void {
    const m = mod as ModuleModel & { satisfies?: string[]; requirementsSource?: string };
    w.block(head('module', mod.name, mod), () => {
        satisfiesLine(w, m.satisfies);
        if (m.requirementsSource) w.line(`requirements-source ${quote(m.requirementsSource)}`);
        if (mod.exposes?.length) w.line(`exposes { ${mod.exposes.join(' ')} }`);
        if (mod.requires?.length) w.line(`requires { ${mod.requires.join(' ')} }`);
        if (mod.dependencies?.length) w.line(`depends on { ${mod.dependencies.join(' ')} }`);
        if (mod.definitions) {
            w.blank();
            printGroups(w, mod.definitions);
        }
    });
    w.blank();
}

export function printGroups(w: IndentWriter, groups: DefinitionGroups): void {
    const keys = Object.keys(groups).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    for (const k of keys) {
        for (const c of groups[k] ?? []) {
            printDefinition(w, c);
            w.blank();
        }
    }
}

function rank(key: string): number {
    const i = GROUP_ORDER.indexOf(key);
    return i === -1 ? GROUP_ORDER.length : i;
}

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

/** The DSL keyword(s) of a construct kind. */
export function kindKeyword(c: ConstructModel): string {
    switch (c.kind) {
        case 'read-only-entity':
            return 'read-only entity';
        case 'external-event':
            return 'external event';
        case 'error-event':
            return 'error event';
        case 'temporal-event':
            return 'temporal event';
        case 'domain-service':
            return 'domain service';
        case 'application-service':
            return 'application service';
        case 'infrastructure-service':
            return 'infrastructure service';
        case 'repository':
            return c.readOnly ? 'read-only repository' : 'repository';
        case 'interface':
            return `${c.role ?? 'api'} interface`;
        default:
            return c.kind;
    }
}

/** What follows the name on the head line (`of ValueType`, `for Entity`). */
export function kindHeadSuffix(c: ConstructModel): string {
    if (c.kind === 'enum' && c.valueType) return ` of ${c.valueType}`;
    if (c.kind === 'repository' && c.for) return ` for ${c.for}`;
    return '';
}

export function printDefinition(w: IndentWriter, c: ConstructModel): void {
    const r = c as ConstructModel & Rec;
    w.block(head(kindKeyword(c), c.name, c, kindHeadSuffix(c)), () => {
        satisfiesLine(w, c.satisfies);
        switch (c.kind) {
            case 'enum':
                for (const v of (r.values as Rec[]) ?? []) {
                    w.line(`${v.name}${v.value !== undefined ? ` = ${printLiteral(v.value)}` : ''}${describe(v.description as string | undefined)}`);
                }
                break;
            case 'value':
                printFields(w, c.fields);
                printOperations(w, r.operations as OperationModel[] | undefined, 'value');
                printInvariantsBlock(w, r.invariants as Rec[] | undefined);
                break;
            case 'entity':
                printIdentity(w, r.identity);
                printDuplicateDetection(w, r.duplicateDetection);
                printFields(w, c.fields);
                printReferences(w, r.references as Rec[] | undefined);
                printOperations(w, r.operations as OperationModel[] | undefined, 'entity');
                printStates(w, r.stateMachines as Rec[] | undefined);
                printInvariantsBlock(w, r.invariants as Rec[] | undefined);
                break;
            case 'read-only-entity':
                w.line(`sourced-from ${nameOrString(String(r.sourcedFrom ?? ''))}`);
                if (r.syncedVia) w.line(`synced-via ${r.syncedVia}`);
                if (r.projectedBy) w.line(`projected-by ${r.projectedBy}`);
                printIdentity(w, r.identity);
                printFields(w, c.fields);
                printReferences(w, r.references as Rec[] | undefined);
                printOperations(w, r.operations as OperationModel[] | undefined, 'safe');
                printInvariantsBlock(w, r.invariants as Rec[] | undefined);
                break;
            case 'aggregate':
                printIdentity(w, r.identity);
                printDuplicateDetection(w, r.duplicateDetection);
                printFields(w, c.fields);
                w.line(`entities { ${((r.entities as string[]) ?? []).join(' ')} }`);
                printReferences(w, r.references as Rec[] | undefined);
                printOperations(w, r.operations as OperationModel[] | undefined, 'entity');
                printStates(w, r.stateMachines as Rec[] | undefined);
                printInvariantsBlock(w, r.invariants as Rec[] | undefined);
                break;
            case 'command':
                printIdentity(w, r.identity);
                printFields(w, c.fields);
                break;
            case 'query':
                w.line(`reads-from ${r.readsFrom}`);
                printFields(w, c.fields);
                w.line(`returns ${r.returns}`);
                break;
            case 'event':
            case 'error-event':
                if (r.about) w.line(`about ${r.about}`);
                if (r.causedBy) w.line(`caused-by ${r.causedBy}`);
                printFields(w, c.fields);
                break;
            case 'external-event':
                w.line(`from ${nameOrString(String(r.from ?? ''))}`);
                if (r.about) w.line(`about ${r.about}`);
                printFields(w, c.fields);
                break;
            case 'temporal-event':
                if (r.about) w.line(`about ${r.about}`);
                w.line(printAnchor(r.anchor as Rec));
                if (r.guard !== undefined) w.line(`guard { ${printExpression(r.guard)} }`);
                printFields(w, c.fields);
                break;
            case 'domain-service':
                if (Array.isArray(r.calls) && r.calls.length) w.line(`calls { ${(r.calls as string[]).join(' ')} }`);
                printOperations(w, (r.operations as OperationModel[] | undefined) ?? [], 'entity');
                break;
            case 'application-service':
                if (r.exposedBy) w.line(`exposed-by ${r.exposedBy}`);
                printOperations(w, (r.operations as OperationModel[] | undefined) ?? [], 'entity');
                break;
            case 'infrastructure-service':
                if (r.describedBy) w.line(`described-by ${r.describedBy}`);
                printOperations(w, (r.operations as OperationModel[] | undefined) ?? [], 'signature');
                break;
            case 'repository':
                if (r.describedBy) w.line(`described-by ${r.describedBy}`);
                for (const op of (r.operations as OperationModel[]) ?? []) printSignature(w, op);
                break;
            case 'interface':
                for (const p of (r.exposes as string[]) ?? []) w.line(`exposes ${p}`);
                if (r.describes) w.line(`describes ${r.describes}`);
                for (const op of (r.operations as OperationModel[]) ?? []) printSignature(w, op);
                break;
            case 'reaction':
                w.line(`triggered-by ${((r.triggeredBy as string[]) ?? []).join(', ')}`);
                if (r.guard !== undefined) w.line(`guard { ${printExpression(r.guard)} }`);
                w.line(`effects ${r.effects}`);
                break;
            case 'invariant':
                w.line(`on ${r.on}`);
                w.line(`must { ${printExpression(r.must)} }`);
                w.line(`enforcement ${printEnforcement(r.enforcement)}`);
                break;
            case 'agreement':
                w.line(`participants { ${((r.participants as string[]) ?? []).join(', ')} }`);
                w.line(`predicate { ${printExpression(r.predicate)} }`);
                printReconciliation(w, r.reconciliation as Rec);
                break;
            default:
                w.comment(`unprintable construct kind "${c.kind}"`);
        }
    });
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

function printIdentity(w: IndentWriter, identity: unknown): void {
    const id = identity as { name: string; type: string } | undefined;
    if (id) w.line(`identity ${id.name} : ${id.type}`);
}

function printDuplicateDetection(w: IndentWriter, expr: unknown): void {
    if (expr !== undefined) w.line(`duplicate detection { ${printExpression(expr)} }`);
}

/** A constraint as the normalizer spells it (`range(1..5)`, `default(USD)`, `pattern(x)`) back to DSL syntax. */
export function printConstraint(c: string): string {
    const m = /^([A-Za-z]+)\((.*)\)$/.exec(c);
    if (!m) return c;
    const [, kind, arg] = m;
    if (kind === 'range') {
        const [lo, hi] = arg.split('..');
        return `range(${lo.trim()}, ${(hi ?? '').trim()})`;
    }
    if (kind === 'pattern') return `pattern(${/^".*"$/.test(arg) ? arg : quote(arg)})`;
    if (kind === 'default') return `default(${literal(/^".*"$/.test(arg) ? arg.slice(1, -1) : arg)})`;
    return `${kind}(${arg})`;
}

export function fieldLine(f: FieldModel): string {
    const parts = [`${f.name} : ${f.type}${f.optional ? '?' : ''}`];
    for (const c of f.constraints ?? []) parts.push(printConstraint(c));
    let s = parts.join(' ') + describe(f.description);
    if (f.satisfies?.length) s += ` satisfies [${f.satisfies.join(', ')}]`;
    return s;
}

function printFields(w: IndentWriter, fields: FieldModel[] | undefined): void {
    if (!fields?.length) {
        w.line('fields { }');
        return;
    }
    w.block('fields', () => {
        for (const f of fields) w.line(fieldLine(f));
    });
}

export function referenceLine(r: Rec): string {
    return `${r.name} : ${r.target} ${r.cardinality}${describe(r.description as string | undefined)}`;
}

function printReferences(w: IndentWriter, refs: Rec[] | undefined): void {
    if (!refs?.length) return;
    w.block('references', () => {
        for (const r of refs) w.line(referenceLine(r));
    });
}

function printAnchor(a: Rec | undefined): string {
    if (!a) return 'schedule ""';
    if (a.kind === 'relative') return `reference ${a.reference} offset ${printExpression(a.offset)}`;
    if (a.kind === 'absolute') return `instant ${a.instant}`;
    return `schedule ${quote(String(a.schedule ?? ''))}`;
}

export function printEnforcement(e: unknown): string {
    return String(e ?? 'rejection');
}

// ---------------------------------------------------------------------------
// Operations — four flavours share one model; the owner decides the syntax.
// ---------------------------------------------------------------------------

export type OperationFlavour = 'entity' | 'value' | 'safe' | 'signature';

function params(op: OperationModel): string {
    return (op.accepts ?? []).join(', ');
}

function opHead(op: OperationModel): string {
    const ret = op.returns ? ` : ${op.returns}` : '';
    const base = op.on ? `${quote(op.name)} on ${op.on}` : `${identOrString(op.name)}(${params(op)})${ret}`;
    return `${base}${describe(op.description)}${metaHead(op.metadata)}`;
}

function hasBody(op: OperationModel): boolean {
    return Boolean(op.satisfies?.length || op.safety || op.idempotent || (op.detail && op.detail.length));
}

function printBody(w: IndentWriter, op: OperationModel): void {
    satisfiesLine(w, op.satisfies);
    if (op.safety) w.line(op.safety);
    if (op.idempotent) w.line('idempotent');
    for (const clause of (op.detail as Rec[]) ?? []) printClause(w, clause);
}

export function printOperation(w: IndentWriter, op: OperationModel, flavour: OperationFlavour): void {
    if (flavour === 'signature') {
        printSignature(w, op);
        return;
    }
    const mandatoryBraces = flavour === 'entity' || flavour === 'safe';
    if (!mandatoryBraces && !hasBody(op)) {
        w.line(opHead(op));
        return;
    }
    w.block(opHead(op), () => printBody(w, op));
}

export function printSignature(w: IndentWriter, op: OperationModel): void {
    if (!hasBody(op)) {
        w.line(opHead(op));
        return;
    }
    w.block(opHead(op), () => {
        satisfiesLine(w, op.satisfies);
        for (const clause of (op.detail as Rec[]) ?? []) printClause(w, clause);
    });
}

function printOperations(w: IndentWriter, ops: OperationModel[] | undefined, flavour: OperationFlavour): void {
    if (!ops) return;
    w.block('operations', () => {
        for (const op of ops) printOperation(w, op, flavour);
    });
}

/** `operations { … }` as text, for a Markdown island. */
export function operationsIsland(ops: OperationModel[] | undefined, flavour: OperationFlavour): string | undefined {
    if (!ops?.length) return undefined;
    const w = new IndentWriter('  ');
    if (flavour === 'signature') for (const op of ops) printSignature(w, op);
    else printOperations(w, ops, flavour);
    return w.toString();
}

export function printClause(w: IndentWriter, c: Rec): void {
    switch (c.kind) {
        case 'precondition': {
            const h = `precondition ${identOrString(String(c.name))}${describe(c.description as string | undefined)}${metaHead(metaOfClause(c))}`;
            w.block(h, () => {
                satisfiesLine(w, idsOf(c.satisfies));
                for (const e of (c.exprs as unknown[]) ?? []) w.line(printExpression(e));
            }, ` rejects ${quote(String(c.reason ?? ''))}`);
            return;
        }
        case 'postcondition': {
            const h = `postcondition ${identOrString(String(c.name))}${describe(c.description as string | undefined)}${metaHead(metaOfClause(c))}`;
            w.block(h, () => {
                satisfiesLine(w, idsOf(c.satisfies));
                for (const e of (c.exprs as unknown[]) ?? []) w.line(printExpression(e));
            });
            return;
        }
        case 'resolves':
            w.line(`resolves ${c.type} from ${c.source}`);
            return;
        case 'creates':
        case 'sets':
            printAssignments(w, `${c.kind} ${c.type}`, c.assignments as Rec[] | undefined, true);
            return;
        case 'emits':
            printAssignments(w, `emits ${c.event}`, c.assignments as Rec[] | undefined, false);
            return;
        case 'serviceCall':
            w.line(`${c.path}(${printArgs(c.args)})${describe(c.description as string | undefined)}`);
            return;
        case 'returns':
            w.line(`returns ${printExpression(c.value)}`);
            return;
        case 'foreach':
            w.block(`foreach ${c.collection} as ${c.variable}`, () => {
                for (const b of (c.body as Rec[]) ?? []) printClause(w, b);
            });
            return;
        default:
            w.comment(`unprintable clause ${JSON.stringify(c)}`);
    }
}

function printAssignments(w: IndentWriter, headText: string, assignments: Rec[] | undefined, braces: boolean): void {
    if (!assignments?.length) {
        w.line(braces ? `${headText} { }` : headText);
        return;
    }
    w.block(headText, () => {
        for (const a of assignments) w.line(`${a.field} = ${printExpression(a.value)}`);
    });
}

function metaOfClause(c: Rec): Record<string, unknown> | undefined {
    const m = c.metadata as { entries?: { key: string; value: unknown }[] } | Record<string, unknown> | undefined;
    if (!m) return undefined;
    if (Array.isArray((m as { entries?: unknown }).entries)) {
        return Object.fromEntries(((m as { entries: { key: string; value: unknown }[] }).entries).map(e => [e.key, e.value]));
    }
    return m as Record<string, unknown>;
}

function idsOf(s: unknown): string[] | undefined {
    if (!s) return undefined;
    if (Array.isArray(s)) return s as string[];
    const ids = (s as { ids?: string[] }).ids;
    return Array.isArray(ids) ? ids : undefined;
}

// ---------------------------------------------------------------------------
// States & invariants
// ---------------------------------------------------------------------------

export function printStates(w: IndentWriter, machines: Rec[] | undefined): void {
    if (!machines?.length) return;
    w.block('states', () => {
        for (const m of machines) {
            w.block(`machine ${m.name}${describe(m.description as string | undefined)}${metaHead(m.metadata as Record<string, unknown> | undefined)}`, () => {
                satisfiesLine(w, m.satisfies as string[] | undefined);
                for (const s of (m.states as Rec[]) ?? []) {
                    const h = `${s.kind ?? 'state'} ${s.name}${describe(s.description as string | undefined)}${metaHead(s.metadata as Record<string, unknown> | undefined)}`;
                    const inv = s.invariants as Rec[] | undefined;
                    const sat = s.satisfies as string[] | undefined;
                    if (inv?.length || sat?.length) {
                        w.block(h, () => {
                            satisfiesLine(w, sat);
                            printInvariantsBlock(w, inv);
                        });
                    } else {
                        w.line(h);
                    }
                }
                for (const t of (m.transitions as Rec[]) ?? []) {
                    const h = `${t.from} --> ${t.to} on ${identOrString(String(t.on))}${describe(t.description as string | undefined)}${metaHead(t.metadata as Record<string, unknown> | undefined)}`;
                    const conds = t.conditions as Rec[] | undefined;
                    const sat = t.satisfies as string[] | undefined;
                    if (conds?.length || sat?.length) {
                        w.block(h, () => {
                            satisfiesLine(w, sat);
                            for (const c of conds ?? []) printClause(w, c);
                        });
                    } else {
                        w.line(h);
                    }
                }
            });
        }
    });
}

export function statesIsland(machines: Rec[] | undefined): string | undefined {
    if (!machines?.length) return undefined;
    const w = new IndentWriter('  ');
    printStates(w, machines);
    return w.toString();
}

export function printInvariantsBlock(w: IndentWriter, invariants: Rec[] | undefined): void {
    if (!invariants?.length) return;
    w.block('invariants', () => {
        for (const inv of invariants) {
            const p = inv.params as string[] | undefined;
            const h = `${inv.name}${p ? `(${p.join(', ')})` : ''}${describe(inv.description as string | undefined)}${metaHead(inv.metadata as Record<string, unknown> | undefined)}`;
            w.block(h, () => {
                satisfiesLine(w, inv.satisfies as string[] | undefined);
                w.line(printExpression(inv.expression));
                w.line(`enforcement ${printEnforcement(inv.enforcement)}`);
            });
        }
    });
}

export function invariantsIsland(invariants: Rec[] | undefined): string | undefined {
    if (!invariants?.length) return undefined;
    const w = new IndentWriter('  ');
    printInvariantsBlock(w, invariants);
    return w.toString();
}

// ---------------------------------------------------------------------------
// Reconciliation (agreement)
// ---------------------------------------------------------------------------

export function printReconciliation(w: IndentWriter, r: Rec | undefined): void {
    if (!r) return;
    w.block(`reconciliation ${r.name}${describe(r.description as string | undefined)}${metaHead(r.metadata as Record<string, unknown> | undefined)}`, () => {
        satisfiesLine(w, r.satisfies as string[] | undefined);
        const trig = (r.trigger as Rec) ?? {};
        w.line(trig.schedule !== undefined ? `trigger schedule ${quote(String(trig.schedule))}` : `trigger event ${((trig.events as string[]) ?? []).join(', ')}`);
        w.line(`detection ${r.detection}`);
        w.line(`compensation { ${((r.compensation as string[]) ?? []).join(', ')} }`);
        if (r.coordination) w.line(`coordination ${r.coordination}`);
        const esc = r.escalation as Rec | Rec[] | undefined;
        if (esc) {
            // 1.6.0 wrote the steps as a bare array; 1.7.0 wraps them with their description.
            const steps = (Array.isArray(esc) ? esc : (esc.steps as Rec[] | undefined)) ?? [];
            const meta = Array.isArray(esc) ? undefined : (esc.metadata as Record<string, unknown> | undefined);
            const desc = Array.isArray(esc) ? undefined : (esc.description as string | undefined);
            const sat = Array.isArray(esc) ? undefined : (esc.satisfies as string[] | undefined);
            w.block(`escalation${describe(desc)}${metaHead(meta)}`, () => {
                satisfiesLine(w, sat);
                for (const s of steps) {
                    w.block(`step ${s.name}${describe(s.description as string | undefined)}${metaHead(s.metadata as Record<string, unknown> | undefined)}`, () => {
                        satisfiesLine(w, s.satisfies as string[] | undefined);
                        w.line(`when { ${printExpression(s.when)} }`);
                        w.line(`action ${printAction(s.action as Rec)}`);
                    });
                }
            });
        }
    });
}

function printAction(a: Rec | undefined): string {
    if (!a) return 'suspend';
    switch (a.kind) {
        case 'retry':
            return `retry(${a.count})`;
        case 'compensate':
            return `compensate { ${((a.commands as string[]) ?? []).join(', ')} }`;
        case 'alert':
            return `alert ${quote(String(a.message ?? ''))}`;
        case 'manual':
            return `manual ${quote(String(a.message ?? ''))}`;
        default:
            return 'suspend';
    }
}

export function reconciliationIsland(r: Rec | undefined): string | undefined {
    if (!r) return undefined;
    const w = new IndentWriter('  ');
    printReconciliation(w, r);
    return w.toString();
}

/** Exposed for the Markdown writer: is this a name the DSL writes bare? */
export { isTypeName };
