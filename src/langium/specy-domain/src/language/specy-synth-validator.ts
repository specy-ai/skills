/**
 * Semantic rules of the scenario metamodel: what the grammar cannot say and the
 * linker does not check. Each rule mirrors a refusal of the synthy planner
 * (src/engine/plan.ts) and carries its conflict code, so the editor shows the
 * same objection the generator would raise, before any row exists.
 *
 * What the grammar enforces is absent here: a population is count or per, an
 * outcome has a kind, a given has one source. What the linker enforces is absent
 * too: an unknown entity, field, state or member is a linking error.
 */
import { DefaultDocumentValidator, type AstNode, type LangiumCoreServices, type LangiumDocument, type LangiumDocuments, type ValidationAcceptor, type ValidationChecks, type ValidationOptions } from 'langium';
import type { Diagnostic } from 'vscode-languageserver-types';
import * as ast from '../generated/ast.js';
import type { SpecySynthServices } from './specy-synth-module.js';
import { DomainAstIndex, NUMERIC_PRIMITIVES, TEMPORAL_PRIMITIVES, domainOf, givenRowsOf, isEntityLike, isMachineStep, isRowSource, previousOf, type ResolvedSynthPath } from './specy-synth-domain-index.js';
import { pathText } from './specy-synth-linker.js';

export function registerSynthValidationChecks(services: SpecySynthServices): void {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.SpecySynthValidator;
    validator.documents = services.shared.workspace.LangiumDocuments;
    const checks: ValidationChecks<ast.SpecyDomainAstType> = {
        ScenarioDef: [validator.checkDomainLoaded, validator.checkTimeline, validator.checkPopulationsDistinct, validator.checkGivensDistinct, validator.checkOutcomesDisjoint],
        PopulationDecl: validator.checkPopulation,
        CurveOutcome: validator.checkCurve,
        TotalOutcome: validator.checkTotal,
        ShareOutcome: validator.checkShare,
        MixOutcome: validator.checkMix,
        RateOutcome: validator.checkRate,
        RollupOutcome: validator.checkRollup,
        AlphaOption: validator.checkAlpha,
        DecimalsOption: validator.checkDecimals,
        NullRateOption: validator.checkNullRate,
        DefaultDwellOption: validator.checkDefaultDwell,
        ReactionLatencyOption: validator.checkReactionLatency,
        RejectionsOption: validator.checkRejections,
        DwellEntry: validator.checkDwell,
        GivenDecl: validator.checkGiven,
        VocabularyBlock: validator.checkVocabulary,
        WordListDecl: validator.checkWordList,
        DistributionsBlock: validator.checkDistributionsDistinct,
        DistributionDecl: validator.checkDistribution,
    };
    registry.register(checks, validator);
}

type Want = 'numeric' | 'temporal' | 'categorical';

/**
 * Reports linking errors except the cascade: once `Order.totalAmout` is red,
 * the `.amount` after it is not a second mistake.
 */
export class SpecySynthDocumentValidator extends DefaultDocumentValidator {
    constructor(services: LangiumCoreServices) {
        super(services);
    }

    protected override processLinkingErrors(document: LangiumDocument, diagnostics: Diagnostic[], options: ValidationOptions): void {
        const kept: Diagnostic[] = [];
        super.processLinkingErrors(document, kept, options);
        const cascades = new Set<string>();
        const codes = new Map<string, string>();
        for (const reference of document.references) {
            const err = reference.error;
            if (!err) continue;
            if (ast.isSynthPathStep(err.container) && previousOf(err.container) === undefined) cascades.add(err.message);
            const code = linkingCode(err.container, err.property);
            if (code) codes.set(err.message, code);
        }
        for (const d of kept) {
            if (cascades.has(d.message)) continue;
            const code = codes.get(d.message);
            diagnostics.push(code ? { ...d, code } : d);
        }
    }
}

/**
 * The planner's code for a name that does not resolve, so the editor, the CLI
 * and an agent read the same code whichever of them caught it first.
 */
function linkingCode(node: AstNode, property: string): string | undefined {
    if (ast.isSynthPath(node)) return 'SYN-E001';
    if (ast.isGivenDecl(node)) return 'SYN-E001';
    if (ast.isPopulationDecl(node)) return property === 'clock' ? 'SYN-E006' : 'SYN-E001';
    if (ast.isSynthPathStep(node)) return ast.isGivenColumn(node.$container) ? 'SYN-E023' : isMachineStep(node) ? 'SYN-E008' : 'SYN-E005';
    if (ast.isShareEntry(node) || ast.isShareGroup(node)) return 'SYN-E007';
    if (ast.isMixEntry(node)) return 'SYN-E008';
    if (ast.isRatePredicate(node)) return 'SYN-E009';
    return undefined;
}

export class SpecySynthValidator {
    documents!: LangiumDocuments;

    // ------------------------------------------------------------------ scenario

    checkDomainLoaded(s: ast.ScenarioDef, accept: ValidationAcceptor): void {
        const lookup = domainOf(s, this.documents);
        if (!lookup.declared) return;
        if (!lookup.document) {
            accept('error', `domain-source "${lookup.declared}" is not loaded: no such file next to this scenario, or the editor has not opened its folder. Nothing in this scenario can be resolved until it is.`, { node: s.domainSource, property: 'path', code: 'SYN-E001' });
        } else if (!lookup.index) {
            accept('error', `domain-source "${lookup.declared}" is not a .domain model.`, { node: s.domainSource, property: 'path', code: 'SYN-E001' });
        } else if ((lookup.document.diagnostics ?? []).some(d => d.severity === 1) || lookup.document.parseResult.parserErrors.length > 0) {
            accept('warning', `domain-source "${lookup.declared}" has errors of its own; references into it may be incomplete.`, { node: s.domainSource, property: 'path' });
        }
    }

    checkTimeline(s: ast.ScenarioDef, accept: ValidationAcceptor): void {
        const from = s.horizon ? parseInstant(s.horizon.from) : undefined;
        const to = s.horizon ? parseInstant(s.horizon.to) : undefined;
        if (s.horizon) {
            if (from === undefined) accept('error', `"${s.horizon.from}" is not a date (YYYY-MM-DD).`, { node: s.horizon, property: 'from', code: 'SYN-E010' });
            if (to === undefined) accept('error', `"${s.horizon.to}" is not a date (YYYY-MM-DD).`, { node: s.horizon, property: 'to', code: 'SYN-E010' });
            if (from !== undefined && to !== undefined && from >= to) accept('error', 'horizon: from must precede to.', { node: s.horizon, code: 'SYN-E010' });
        }
        if (s.asOf) {
            const asOf = parseInstant(s.asOf.instant);
            if (asOf === undefined) accept('error', `"${s.asOf.instant}" is not an instant (YYYY-MM-DD or ISO date-time).`, { node: s.asOf, property: 'instant', code: 'SYN-E010' });
            else if (from !== undefined && asOf < from) accept('error', 'as-of precedes the horizon: no row could exist yet.', { node: s.asOf, property: 'instant', code: 'SYN-E010' });
        }
        if (!s.horizon) accept('warning', 'No horizon declared; clocks default to the calendar year 2024.', { node: s, property: 'name', code: 'SYN-W004' });
        if (s.seed?.number !== undefined && !/^-?\d+$/.test(s.seed.number)) accept('warning', 'A fractional seed is read as a string.', { node: s.seed, property: 'number' });
    }

    checkPopulationsDistinct(s: ast.ScenarioDef, accept: ValidationAcceptor): void {
        const seen = new Map<string, ast.PopulationDecl>();
        for (const p of s.populations?.populations ?? []) {
            const name = p.entity?.$refText;
            if (!name) continue;
            if (seen.has(name)) accept('error', `Entity "${name}" has two populations.`, { node: p, property: 'entity', code: 'SYN-E002' });
            seen.set(name, p);
        }
        if (s.populations && s.populations.populations.length === 0) accept('warning', 'The scenario declares no population; nothing will be generated.', { node: s.populations, code: 'SYN-W009' });
    }

    checkGivensDistinct(s: ast.ScenarioDef, accept: ValidationAcceptor): void {
        const seen = new Set<string>();
        for (const g of s.givens?.givens ?? []) {
            const name = g.entity?.$refText;
            if (!name) continue;
            if (seen.has(name)) accept('error', `Entity "${name}" has two givens.`, { node: g, property: 'entity', code: 'SYN-E014' });
            seen.add(name);
        }
    }

    /** One outcome per column, one period per time axis, one mix per entity (SYN-E012). */
    checkOutcomesDisjoint(s: ast.ScenarioDef, accept: ValidationAcceptor): void {
        const index = domainOf(s, this.documents).index;
        if (!index) return;
        const pinned = new Map<string, AstNode>();
        const axes = new Map<string, { period: string; keys: string; node: AstNode }>();
        const mixes = new Map<string, AstNode>();
        const pin = (key: string, node: AstNode, what: string) => {
            if (pinned.has(key)) accept('error', `Two outcomes pin ${what}.`, { node, code: 'SYN-E012' });
            else pinned.set(key, node);
        };
        for (const oc of s.outcomes?.outcomes ?? []) {
            if (ast.isCurveOutcome(oc) || ast.isTotalOutcome(oc)) {
                const r = index.resolvePath(oc.measure);
                if (r?.column) pin(`${r.root.name}:${r.column}`, oc, pathText(oc.measure));
            }
            if (ast.isShareOutcome(oc)) {
                const r = index.resolvePath(oc.dimension);
                if (r?.column) pin(`${r.root.name}:${r.column}`, oc, pathText(oc.dimension));
            }
            if (ast.isRateOutcome(oc)) {
                const columns = new Set<string>();
                for (const atom of rateAtoms(oc.predicate)) {
                    const r = atom.path ? index.resolvePath(atom.path) : undefined;
                    if (!r?.column || this.isMachineColumn(index, r) || columns.has(`${r.root.name}:${r.column}`)) continue;
                    columns.add(`${r.root.name}:${r.column}`);
                    pin(`${r.root.name}:${r.column}`, oc, pathText(atom.path));
                }
            }
            if (ast.isRollupOutcome(oc)) {
                const r = oc.parts ? index.resolvePath(oc.parts) : undefined;
                if (r?.column) pin(`${r.root.name}:${r.column}`, oc, pathText(oc.parts));
            }
            if (ast.isMixOutcome(oc)) {
                const name = oc.machine?.root?.$refText;
                if (!name) continue;
                if (mixes.has(name)) accept('error', `Two mixes on ${name}.`, { node: oc, code: 'SYN-E012' });
                else mixes.set(name, oc);
            }
            const atoms = ast.isRateOutcome(oc) ? rateAtoms(oc.predicate) : [];
            if ((ast.isCurveOutcome(oc) && oc.measure && oc.by) || (ast.isRateOutcome(oc) && oc.by && atoms[0]?.path)) {
                const entity = (ast.isCurveOutcome(oc) ? oc.measure : atoms[0].path).root?.$refText;
                if (!entity) continue;
                const by = pathText(oc.by!);
                const period = oc.period ?? '?';
                const keys = oc.points.map(p => p.key).join();
                const axis = `${entity}|${by}`;
                const prev = axes.get(axis);
                if (!prev) axes.set(axis, { period, keys, node: oc });
                else if (prev.period !== period) {
                    accept('error', `Outcomes on ${entity} by ${by} disagree on the period: ${prev.period} and ${period}.`, { node: oc, code: 'SYN-E012' });
                } else if (ast.isCurveOutcome(oc) && ast.isCurveOutcome(prev.node) && prev.keys !== keys) {
                    accept('error', `Two curves on ${entity} by ${by} disagree on their periods; one set of periods per axis.`, { node: oc, code: 'SYN-E012' });
                }
            }
        }
    }

    /** The enum column a machine of the entity drives: its states are members of it. */
    private isMachineColumn(index: DomainAstIndex, r: ResolvedSynthPath): boolean {
        if (r.leaf.kind !== 'enum' || !ast.isEnumDef(r.leaf.def) || !isEntityLike(r.root)) return false;
        const members = new Set(r.leaf.def.values.map(v => v.name.toLowerCase()));
        return index.machinesOf(r.root).some(m => {
            const states = index.stateNamesOf(m);
            return states.length > 0 && states.every(st => members.has(st.toLowerCase()));
        });
    }

    /** The axis a curve or a per-period rate is keyed by: a field of its entity, or of its per parent. */
    private checkAxis(index: DomainAstIndex, oc: ast.CurveOutcome | ast.RateOutcome, root: string, accept: ValidationAcceptor, what: 'curve' | 'per-period rate'): void {
        if (!oc.by) return;
        const by = this.onTable(index, oc.by, 'temporal', accept, oc, 'by');
        const pop = this.populationOf(oc, root);
        if (!by) return;
        if (by.root.name === root) {
            if (pop && pop.count === undefined) {
                accept('error', `A ${what} by a field of ${root} needs a count population; ${root} is per ${pop.parent?.$refText}. Key it by ${pop.parent?.$refText}'s clock instead.`, { node: oc, property: 'by', code: 'SYN-E011' });
            }
            return;
        }
        if (pop?.parent?.$refText === by.root.name) {
            if (ast.isCurveOutcome(oc) && oc.points.some(p => p.rows !== undefined)) accept('error', `A curve keyed by ${by.root.name}'s periods takes the rows its ${by.root.name} rows have: drop "over n rows".`, { node: oc, code: 'SYN-E011' });
            return;
        }
        accept('error', `by ${pathText(oc.by)} must be a field of ${root}${pop?.parent ? ` or of its parent ${pop.parent.$refText}` : ''}.`, { node: oc, property: 'by', code: 'SYN-E006' });
    }

    // ---------------------------------------------------------------- populations

    checkPopulation(p: ast.PopulationDecl, accept: ValidationAcceptor): void {
        const index = this.indexOf(p);
        if (!p.entity) return;
        if (p.count !== undefined && !/^\d+$/.test(p.count)) accept('error', 'count must be a non-negative integer.', { node: p, property: 'count', code: 'SYN-E002' });
        if (p.exactly !== undefined && !/^\d+$/.test(p.exactly)) accept('error', 'exactly must be a non-negative integer.', { node: p, property: 'exactly', code: 'SYN-E002' });
        if (p.range !== undefined) {
            const m = /^(\d+)\.\.(\d+|[nN])$/.exec(p.range);
            if (!m || /[nN]/.test(m[2])) accept('error', `per needs a finite range such as 1..5; "${p.range}" has no upper bound.`, { node: p, property: 'range', code: 'SYN-E003' });
            else if (Number(m[1]) > Number(m[2])) accept('error', `${p.range}: min exceeds max.`, { node: p, property: 'range', code: 'SYN-E003' });
        }
        if (p.parent) {
            const scenario = p.$container.$container;
            const name = p.parent.$refText;
            const hasRows = scenario.populations.populations.some(q => q !== p && q.entity?.$refText === name) || (scenario.givens?.givens ?? []).some(g => g.entity?.$refText === name);
            if (p.parent.ref && !hasRows) accept('error', `${p.entity.$refText} is declared per ${name}, which has no population or given.`, { node: p, property: 'parent', code: 'SYN-E003' });
            if (name === p.entity.$refText) accept('error', 'An entity cannot be per itself.', { node: p, property: 'parent', code: 'SYN-E003' });
            if (index && isEntityLike(p.entity.ref) && isEntityLike(p.parent.ref)) {
                const parentRef = (p.parent.ref.references?.refs ?? []).find(r => r.target === p.entity.$refText && !/\.\.1$/.test(r.cardinality));
                if (parentRef) {
                    const m = /^(\d+)\.\.(\d+|[nN])$/.exec(parentRef.cardinality);
                    const min = Number(p.exactly ?? p.range?.split('..')[0] ?? 0);
                    const max = p.exactly !== undefined ? Number(p.exactly) : Number(p.range?.split('..')[1] ?? 0);
                    if (m && Number(m[1]) > min) accept('error', `${p.parent.$refText}.${parentRef.name} : ${p.entity.$refText} ${parentRef.cardinality} requires at least ${m[1]} per parent; the scenario allows ${min}.`, { node: p, code: 'SYN-E003' });
                    if (m && !/[nN]/.test(m[2]) && Number(m[2]) < max) accept('error', `${p.parent.$refText}.${parentRef.name} : ${p.entity.$refText} ${parentRef.cardinality} allows at most ${m[2]} per parent; the scenario allows ${max}.`, { node: p, code: 'SYN-E003' });
                }
            }
        }
        if (p.since !== undefined) {
            const since = parseInstant(p.since);
            const scenario = p.$container.$container;
            const to = scenario.horizon ? parseInstant(scenario.horizon.to) : undefined;
            if (since === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(p.since.replace(/"/g, ''))) accept('error', `since "${p.since}" is not a date (YYYY-MM-DD).`, { node: p, property: 'since', code: 'SYN-E010' });
            else if (to !== undefined && since >= to) accept('error', `since ${p.since} must come before the horizon's end.`, { node: p, property: 'since', code: 'SYN-E010' });
        }
        if (p.clock?.ref && index) {
            const t = index.leafOf(p.clock.ref);
            if (!(t.kind === 'primitive' && TEMPORAL_PRIMITIVES.has(t.name))) accept('error', `clock ${p.clock.$refText} of ${p.entity.$refText} must be a date or datetime field; it is ${t.name}.`, { node: p, property: 'clock', code: 'SYN-E006' });
        }
    }

    // ------------------------------------------------------------------- outcomes

    checkCurve(oc: ast.CurveOutcome, accept: ValidationAcceptor): void {
        const index = this.indexOf(oc);
        if (!index || !oc.measure || !oc.by) return;
        const m = this.onTable(index, oc.measure, 'numeric', accept, oc, 'measure');
        const pop = m && this.populationOf(oc, m.root.name);
        if (m && !pop && !this.givenOf(oc, m.root.name)) accept('error', `"${m.root.name}" has no population or given.`, { node: oc, property: 'measure', code: 'SYN-E003' });
        if (m) this.checkAxis(index, oc, m.root.name, accept, 'curve');
        this.checkPeriodKeys(oc, oc.points, accept);
        const withRows = oc.points.filter(p => p.rows !== undefined);
        if (withRows.length && withRows.length !== oc.points.length) accept('error', 'Either every period says over n rows, or none does.', { node: oc, code: 'SYN-E011' });
        if (pop?.count !== undefined && withRows.length === oc.points.length && oc.points.length) {
            const sum = oc.points.reduce((s, p) => s + Number(p.rows), 0);
            if (sum !== Number(pop.count)) accept('error', `Rows per period sum to ${sum}; the population count is ${pop.count}.`, { node: oc, code: 'SYN-E011' });
        }
        for (const p of oc.points) if (Number(p.value) === 0 && p.rows !== undefined && Number(p.rows) > 0) accept('warning', `Period ${p.key} declares 0 over ${p.rows} rows: every row carries 0.`, { node: p, property: 'value' });
        if (oc.alpha !== undefined && !(Number(oc.alpha) > 0)) accept('error', 'alpha must be positive.', { node: oc, property: 'alpha', code: 'SYN-E011' });
    }

    checkTotal(oc: ast.TotalOutcome, accept: ValidationAcceptor): void {
        const index = this.indexOf(oc);
        if (!index || !oc.measure) return;
        const m = this.onTable(index, oc.measure, 'numeric', accept, oc, 'measure');
        const pop = m && this.populationOf(oc, m.root.name);
        if (m && !pop && !this.givenOf(oc, m.root.name)) accept('error', `"${m.root.name}" has no population or given.`, { node: oc, property: 'measure', code: 'SYN-E003' });
        if (pop && pop.count === undefined) accept('error', `A total needs a count population; ${pop.entity.$refText} is per ${pop.parent?.$refText}.`, { node: oc, property: 'measure', code: 'SYN-E011' });
        if (oc.alpha !== undefined && !(Number(oc.alpha) > 0)) accept('error', 'alpha must be positive.', { node: oc, property: 'alpha', code: 'SYN-E011' });
    }

    checkShare(oc: ast.ShareOutcome, accept: ValidationAcceptor): void {
        const index = this.indexOf(oc);
        if (!index || !oc.dimension) return;
        const d = this.onTable(index, oc.dimension, 'categorical', accept, oc, 'dimension');
        if (d && !this.populationOf(oc, d.root.name) && !this.givenOf(oc, d.root.name)) accept('error', `"${d.root.name}" has no population or given.`, { node: oc, property: 'dimension', code: 'SYN-E003' });
        const isBoolean = d?.leaf.kind === 'primitive';
        const split = (entries: ast.ShareEntry[], node: AstNode, label: string) => {
            const seen = new Set<string>();
            for (const e of entries) {
                const key = e.member?.$refText ?? e.literal ?? '';
                if (d && isBoolean && e.member) accept('error', `${pathText(oc.dimension)} is boolean: use true and false.`, { node: e, property: 'member', code: 'SYN-E007' });
                if (d && !isBoolean && e.literal) accept('error', `${pathText(oc.dimension)} is an enum: name its members, not ${e.literal}.`, { node: e, property: 'literal', code: 'SYN-E007' });
                if (seen.has(key)) accept('error', `"${key}" is listed twice.`, { node: e, code: 'SYN-E007' });
                seen.add(key);
            }
            this.checkSumsToOne(entries.map(e => e.value), node, label, 'SYN-E007', accept);
        };
        if (!oc.given) {
            for (const g of oc.groups) accept('error', `A split per value needs "given": share ${pathText(oc.dimension)} given <column> { … }.`, { node: g, code: 'SYN-E007' });
            split(oc.shares, oc, `Shares of ${pathText(oc.dimension)}`);
        } else {
            for (const e of oc.shares) accept('error', `With "given", each value of ${pathText(oc.given)} maps to a split: ${e.member?.$refText ?? e.literal}: { … }.`, { node: e, code: 'SYN-E007' });
            const g = this.onTable(index, oc.given, 'categorical', accept, oc, 'given');
            if (g && d && g.root !== d.root) accept('error', `given ${pathText(oc.given)} must be a column of ${d.root.name}.`, { node: oc, property: 'given', code: 'SYN-E006' });
            if (g && d && g.column === d.column) accept('error', `A share of ${pathText(oc.dimension)} cannot be given itself.`, { node: oc, property: 'given', code: 'SYN-E012' });
            if (g && d && g.root === d.root && g.column !== d.column) {
                const byShare = (scenarioOf(oc)?.outcomes?.outcomes ?? []).some(o => ast.isShareOutcome(o) && o !== oc && !o.given && index.resolvePath(o.dimension)?.column === g.column);
                if (!this.isMachineColumn(index, g) && !byShare) accept('error', `${pathText(oc.given)} is generated after the outcomes; a share given it needs it set first: declare a share on it, or give the share the state.`, { node: oc, property: 'given', code: 'SYN-E012' });
            }
            const givenBoolean = g?.leaf.kind === 'primitive';
            const seen = new Set<string>();
            for (const grp of oc.groups) {
                const key = grp.member?.$refText ?? grp.literal ?? '';
                if (g && givenBoolean && grp.member) accept('error', `${pathText(oc.given)} is boolean: its values are true and false.`, { node: grp, property: 'member', code: 'SYN-E007' });
                if (g && !givenBoolean && grp.literal) accept('error', `${pathText(oc.given)} is an enum: name its members, not ${grp.literal}.`, { node: grp, property: 'literal', code: 'SYN-E007' });
                if (seen.has(key)) accept('error', `"${key}" is listed twice.`, { node: grp, code: 'SYN-E007' });
                seen.add(key);
                split(grp.shares, grp, `Shares of ${pathText(oc.dimension)} where ${pathText(oc.given)} = ${key}`);
            }
        }
        if (d && this.isStateColumn(index, oc, d)) accept('error', `${pathText(oc.dimension)} is driven by the state machine; declare a mix instead of a share.`, { node: oc, property: 'dimension', code: 'SYN-E009' });
    }

    checkMix(oc: ast.MixOutcome, accept: ValidationAcceptor): void {
        const index = this.indexOf(oc);
        if (!index || !oc.machine) return;
        const root = oc.machine.root?.ref;
        if (!root) return;
        if (!isEntityLike(root)) {
            accept('error', `${root.name} is a value type; only entities have state machines.`, { node: oc.machine, property: 'root', code: 'SYN-E008' });
            return;
        }
        if (oc.machine.steps.length > 1) {
            accept('error', 'A mix names Entity or Entity.Machine.', { node: oc.machine, code: 'SYN-E008' });
            return;
        }
        const machine = index.machineAt(oc.machine);
        if (!machine) {
            const named = oc.machine.steps[0]?.target;
            if (named?.ref) accept('error', `${pathText(oc.machine)} is not a state machine.`, { node: oc.machine.steps[0], property: 'target', code: 'SYN-E008' });
            else if (!named) accept('error', `${root.name} has no state machine.`, { node: oc.machine, property: 'root', code: 'SYN-E008' });
            return;
        }
        if (!this.populationOf(oc, root.name) && !this.givenOf(oc, root.name)) accept('error', `"${root.name}" has no population or given.`, { node: oc.machine, property: 'root', code: 'SYN-E003' });
        const reach = index.reachableStatesOf(machine);
        const seen = new Set<string>();
        for (const e of oc.states) {
            const name = e.state?.$refText;
            if (!name) continue;
            if (e.state.ref && !reach.has(name)) accept('error', `State "${name}" is not reachable from [*] in ${root.name}.${machine.name}.`, { node: e, property: 'state', code: 'SYN-E008' });
            if (seen.has(name)) accept('error', `"${name}" is listed twice.`, { node: e, code: 'SYN-E008' });
            seen.add(name);
        }
        this.checkSumsToOne(oc.states.map(e => e.value), oc, `Mix of ${pathText(oc.machine)}`, 'SYN-E008', accept);
    }

    checkRate(oc: ast.RateOutcome, accept: ValidationAcceptor): void {
        const index = this.indexOf(oc);
        const atoms = rateAtoms(oc.predicate);
        if (!index || !atoms.length || atoms.some(a => !a.path)) return;
        const resolved: { atom: ast.RatePredicate; r: ResolvedSynthPath }[] = [];
        for (const pred of atoms) {
            const d = this.onTable(index, pred.path, 'categorical', accept, pred, 'path');
            if (!d) continue;
            resolved.push({ atom: pred, r: d });
            const isBoolean = d.leaf.kind === 'primitive';
            if (!isBoolean && !pred.member && !pred.literal) accept('error', `Predicate on enum ${d.leaf.name} needs "= member".`, { node: pred, code: 'SYN-E009' });
            if (!isBoolean && pred.literal) accept('error', `${pathText(pred.path)} is an enum: compare it to a member, not ${pred.literal}.`, { node: pred, property: 'literal', code: 'SYN-E009' });
            if (isBoolean && pred.member) accept('error', `${pathText(pred.path)} is boolean: compare it to true or false.`, { node: pred, property: 'member', code: 'SYN-E009' });
        }
        if (!resolved.length) return;
        const roots = new Set(resolved.map(x => x.r.root.name));
        if (roots.size > 1) {
            accept('error', `A rate's predicate reads one entity; this one reads ${[...roots].join(' and ')}.`, { node: oc, property: 'predicate', code: 'SYN-E009' });
            return;
        }
        const root = resolved[0].r.root.name;
        const machineAtoms = resolved.filter(x => this.isMachineColumn(index, x.r));
        const simple = ast.isRatePredicate(oc.predicate) && oc.predicate.op !== '!=';
        if (simple && machineAtoms.length) accept('error', `${pathText(atoms[0].path)} is driven by the state machine; declare a mix instead of a rate.`, { node: oc.predicate, code: 'SYN-E009' });
        else if (machineAtoms.length === resolved.length) accept('error', `Every column this predicate reads is driven by the state machine; declare a mix instead.`, { node: oc, property: 'predicate', code: 'SYN-E009' });
        const pop = this.populationOf(oc, root);
        if (!pop && !this.givenOf(oc, root)) accept('error', `"${root}" has no population or given.`, { node: atoms[0], property: 'path', code: 'SYN-E003' });
        if (oc.by) this.checkAxis(index, oc, root, accept, 'per-period rate');
        for (const f of oc.value ? [oc.value] : oc.points.map(p => p.value)) {
            if (!f || f.value === undefined) continue;
            const v = fraction(f);
            if (v < 0 || v > 1) accept('error', `Rate ${f.$cstNode?.text ?? v} is outside [0, 1].`, { node: f, code: 'SYN-E009' });
        }
        if (oc.by) this.checkPeriodKeys(oc, oc.points, accept);
    }

    checkRollup(oc: ast.RollupOutcome, accept: ValidationAcceptor): void {
        const index = this.indexOf(oc);
        if (!index || !oc.total || !oc.parts) return;
        const t = this.onTable(index, oc.total, 'numeric', accept, oc, 'total');
        const p = this.onTable(index, oc.parts, 'numeric', accept, oc, 'parts');
        if (!t || !p) return;
        const child = this.populationOf(oc, p.root.name);
        if (!this.populationOf(oc, t.root.name) && !this.givenOf(oc, t.root.name)) accept('error', `"${t.root.name}" has no population or given.`, { node: oc, property: 'total', code: 'SYN-E003' });
        if (!child) accept('error', `"${p.root.name}" has no population.`, { node: oc, property: 'parts', code: 'SYN-E003' });
        else if (child.parent?.$refText !== t.root.name) accept('error', `${p.root.name} must be declared per ${t.root.name} for the rollup to hold.`, { node: oc, property: 'parts', code: 'SYN-E013' });
    }

    // -------------------------------------------------------------------- options

    checkAlpha(o: ast.AlphaOption, accept: ValidationAcceptor): void {
        if (o.value !== undefined && !(Number(o.value) > 0)) accept('error', 'alpha must be positive.', { node: o, property: 'value', code: 'SYN-E015' });
    }

    checkDecimals(o: ast.DecimalsOption, accept: ValidationAcceptor): void {
        if (o.value !== undefined && !/^\d$/.test(o.value)) accept('error', 'decimals must be an integer from 0 to 9.', { node: o, property: 'value', code: 'SYN-E015' });
    }

    checkNullRate(o: ast.NullRateOption, accept: ValidationAcceptor): void {
        if (o.value?.value === undefined) return;
        const v = fraction(o.value);
        if (v < 0 || v > 1) accept('error', 'null-rate is a probability in [0, 1].', { node: o, property: 'value', code: 'SYN-E015' });
    }

    checkDefaultDwell(o: ast.DefaultDwellOption, accept: ValidationAcceptor): void {
        if (o.value !== undefined && !isDuration(o.value)) accept('error', `Cannot read duration "${o.value}": use 4h, 2d, 45min, 30s, 1w or an ISO duration such as "PT2H".`, { node: o, property: 'value', code: 'SYN-E015' });
    }

    checkReactionLatency(o: ast.ReactionLatencyOption, accept: ValidationAcceptor): void {
        if (o.value !== undefined && !isDuration(o.value)) accept('error', `Cannot read duration "${o.value}": use 30s, 1min, 4h or an ISO duration such as "PT30S".`, { node: o, property: 'value', code: 'SYN-E015' });
    }

    checkRejections(o: ast.RejectionsOption, accept: ValidationAcceptor): void {
        if (o.value !== undefined && !/^\d+$/.test(o.value)) accept('error', 'rejections is a count of commands per precondition: a non-negative integer.', { node: o, property: 'value', code: 'SYN-E015' });
    }

    checkDwell(e: ast.DwellEntry, accept: ValidationAcceptor): void {
        if (e.from === undefined || e.to === undefined) return;
        if (e.duration !== undefined && !isDuration(e.duration)) accept('error', `Cannot read duration "${e.duration}": use 4h, 2d, 45min, 30s, 1w or an ISO duration such as "PT2H".`, { node: e, property: 'duration', code: 'SYN-E015' });
        const index = this.indexOf(e);
        if (!index) return;
        const machines = index.rowSources().flatMap(c => index.machinesOf(c));
        const matching = machines.filter(m => index.transitionsOf(m).some(t => t.source === e.from && t.target === e.to));
        if (matching.length === 0) {
            const knowsFrom = machines.some(m => index.stateNamesOf(m).includes(e.from));
            const knowsTo = machines.some(m => index.stateNamesOf(m).includes(e.to));
            if (!knowsFrom) accept('warning', `No state machine of the domain has a state "${e.from}".`, { node: e, property: 'from' });
            else if (!knowsTo) accept('warning', `No state machine of the domain has a state "${e.to}".`, { node: e, property: 'to' });
            else accept('warning', `No state machine declares a transition ${e.from} --> ${e.to}; this dwell will never apply.`, { node: e });
        }
    }

    // ------------------------------------------------------------------- givens

    checkGiven(g: ast.GivenDecl, accept: ValidationAcceptor): void {
        const index = this.indexOf(g);
        const target = g.entity?.ref;
        if (!index || !target) return;
        const scenario = g.$container.$container;
        const name = g.entity.$refText;
        if (ast.isEnumDef(target)) {
            const vt = index.construct(target.valueType);
            if (!ast.isValueDef(vt)) accept('error', `${name} holds instances of ${target.valueType ?? '?'}, which is not a value type of the domain.`, { node: g, property: 'entity', code: 'SYN-E023' });
            else if (!vt.fields.fields.some(f => f.constraints.some(c => c.kind === 'code'))) accept('error', `${vt.name} declares no code field, so given instances cannot be matched to the members of ${name}. Mark the field that names each value with \`code\`.`, { node: g, property: 'entity', code: 'SYN-E023' });
            if (scenario.populations.populations.some(p => p.entity?.$refText === name)) accept('error', `${name} is an enum: its instances are given, it has no population.`, { node: g, property: 'entity', code: 'SYN-E014' });
        }
        const per = scenario.populations.populations.find(p => p.entity?.$refText === name && p.parent);
        if (per) accept('error', `${name} is given, so its rows are not generated per ${per.parent?.$refText}. Drop the population and supply the key of each row's ${per.parent?.$refText} in the given.`, { node: g, property: 'entity', code: 'SYN-E014' });
        const rowsOf = givenRowsOf(index, g);
        const seen = new Set<string>();
        const supplied = new Map<string, ast.GivenColumn>();
        for (const c of g.columns) {
            const text = c.steps.map(st => st.target?.$refText ?? '?').join('.');
            if (seen.has(text)) accept('error', `${text} is mapped twice.`, { node: c, code: 'SYN-E023' });
            seen.add(text);
            const last = c.steps[c.steps.length - 1]?.target?.ref;
            if (!last) continue;
            const leaf = index.leafOf(last);
            if (ast.isReferenceDecl(last) && c.steps.length === 1 && leaf.kind !== 'collection') continue; // the reference's key column
            if (leaf.kind === 'value') accept('error', `${text} is a value of ${leaf.name}; map its fields (${text}.<field>).`, { node: c, code: 'SYN-E023' });
            else if (leaf.kind === 'collection' && (leaf.element?.kind === 'value' || leaf.element?.kind === 'entity')) accept('error', `${text} is a collection of ${leaf.element?.name}: those are rows of their own; give them separately.`, { node: c, code: 'SYN-E023' });
            else if (c.steps.some(st => ast.isReferenceDecl(st.target?.ref)) && c.steps.length > 1) accept('error', `${text} crosses a reference; a given maps columns of ${rowsOf?.name ?? name}'s own table.`, { node: c, code: 'SYN-E023' });
            else supplied.set(text, c);
        }
        if (!isRowSource(target)) return;
        // outcomes that would set a column the given maps
        for (const oc of scenario.outcomes?.outcomes ?? []) {
            const paths: (ast.SynthPath | undefined)[] = ast.isShareOutcome(oc) ? [oc.dimension] : ast.isCurveOutcome(oc) || ast.isTotalOutcome(oc) ? [oc.measure] : ast.isRollupOutcome(oc) ? [oc.parts] : ast.isRateOutcome(oc) ? rateAtoms(oc.predicate).map(a => a.path) : [];
            for (const p of paths) {
                if (!p || p.root?.$refText !== name) continue;
                const rel = p.steps.map(st => st.target?.$refText ?? '').join('.');
                if (supplied.has(rel)) accept('error', `${oc.$type.replace('Outcome', '').toLowerCase()} ${pathText(p)} sets ${rel}, which the given supplies (from "${supplied.get(rel)!.source}").`, { node: supplied.get(rel)!, code: 'SYN-E014' });
            }
            if (ast.isMixOutcome(oc) && oc.machine?.root?.$refText === name) accept('error', `mix ${pathText(oc.machine)} sets the state of ${name}, whose given rows supply it.`, { node: g, property: 'entity', code: 'SYN-E014' });
        }
    }

    // --------------------------------------------------------------- vocabulary

    checkVocabulary(v: ast.VocabularyBlock, accept: ValidationAcceptor): void {
        if (v.locale !== undefined && !canonicalLocale(v.locale) && v.pack === undefined) {
            accept('error', `Unknown locale "${v.locale}". Built-in packs: ${BUILT_IN_LOCALES.join(', ')}; a language alone (fr, de, en, es, it, nl) names its usual region. For another locale, write a pack file and name it with \`pack\`.`, { node: v, property: 'locale', code: 'SYN-E024' });
        }
        const seen = new Set<string>();
        for (const w of v.words) {
            const text = pathText(w.field);
            if (seen.has(text)) accept('error', `${text} has two word lists.`, { node: w, property: 'field', code: 'SYN-E024' });
            seen.add(text);
        }
    }

    checkWordList(w: ast.WordListDecl, accept: ValidationAcceptor): void {
        const index = this.indexOf(w);
        if (!index || !w.field) return;
        const r = index.resolvePath(w.field);
        if (!r) return;
        const text = pathText(w.field);
        if (!this.populationOf(w, r.root.name) && !this.givenOf(w, r.root.name)) accept('error', `"${r.root.name}" has no population or given.`, { node: w, property: 'field', code: 'SYN-E003' });
        const leaf = r.leaf.kind === 'collection' && r.leaf.element ? r.leaf.element : r.leaf;
        if (r.viaReference || !(leaf.kind === 'primitive' && (leaf.name === 'string' || leaf.name === 'text'))) {
            accept('error', `Words apply to text fields; ${text} is ${r.viaReference ? 'reached through a reference' : r.leaf.name}.`, { node: w, property: 'field', code: 'SYN-E024' });
            return;
        }
        if (w.file === undefined && w.values.length === 0) accept('error', 'A word list holds at least one value.', { node: w, code: 'SYN-E024' });
        const field = ast.isFieldDecl(r.last) ? r.last : undefined;
        const num = (kind: string) => field?.constraints.find(c => c.kind === kind)?.numValue;
        const maxLength = num('maxLength');
        const minLength = num('minLength');
        const pattern = field?.constraints.find(c => c.kind === 'pattern')?.strValue;
        let re: RegExp | undefined;
        try {
            re = pattern ? new RegExp(pattern) : undefined;
        } catch {
            re = undefined;
        }
        w.values.forEach((x, i) => {
            if (maxLength !== undefined && x.length > Number(maxLength)) accept('error', `"${x}" is longer than maxLength(${maxLength}) of ${text}.`, { node: w, property: 'values', index: i, code: 'SYN-E024' });
            else if (minLength !== undefined && x.length < Number(minLength)) accept('error', `"${x}" is shorter than minLength(${minLength}) of ${text}.`, { node: w, property: 'values', index: i, code: 'SYN-E024' });
            else if (re && !re.test(x)) accept('error', `"${x}" does not match pattern(${pattern}) of ${text}.`, { node: w, property: 'values', index: i, code: 'SYN-E024' });
        });
    }

    // ------------------------------------------------------------ distributions

    checkDistributionsDistinct(b: ast.DistributionsBlock, accept: ValidationAcceptor): void {
        const seen = new Set<string>();
        for (const d of b.distributions) {
            const text = pathText(d.field);
            if (seen.has(text)) accept('error', `${text} has two distributions.`, { node: d, property: 'field', code: 'SYN-E025' });
            seen.add(text);
        }
    }

    checkDistribution(d: ast.DistributionDecl, accept: ValidationAcceptor): void {
        if (d.sigma !== undefined && !(Number(d.sigma) > 0 && Number(d.sigma) <= 5)) accept('error', `sigma must be in (0, 5]; got ${d.sigma}.`, { node: d, property: 'sigma', code: 'SYN-E025' });
        if (d.median !== undefined && !(Number(d.median) > 0)) accept('error', `A lognormal median is a positive number; got ${d.median}.`, { node: d, property: 'median', code: 'SYN-E025' });
        if (d.exponent !== undefined && !(Number(d.exponent) > 0 && Number(d.exponent) <= 5)) accept('error', `A Zipf exponent is in (0, 5]; got ${d.exponent}.`, { node: d, property: 'exponent', code: 'SYN-E025' });
        const index = this.indexOf(d);
        if (!index || !d.field) return;
        const r = index.resolvePath(d.field);
        if (!r) return;
        const text = pathText(d.field);
        const refuse = (why: string) => accept('error', `${d.shape} does not fit ${text}: ${why}.`, { node: d, property: 'shape', code: 'SYN-E025' });
        if (!this.populationOf(d, r.root.name) && !this.givenOf(d, r.root.name)) accept('error', `"${r.root.name}" has no population or given.`, { node: d, property: 'field', code: 'SYN-E003' });
        const last = r.last;
        const isReference = (ast.isReferenceDecl(last) && r.leaf.kind !== 'collection') || (ast.isFieldDecl(last) && r.leaf.kind === 'entity') || (ast.isFieldDecl(last) && r.leaf.kind === 'primitive' && r.leaf.name === 'uuid' && /Id$/.test(last.name) && this.hasRows(d, last.name.slice(0, -2)));
        if (isReference && d.field.steps.length === 1) {
            if (d.shape === 'lognormal') refuse('a reference takes uniform or zipf (some rows are referenced far more often)');
            return;
        }
        if (r.viaReference || !r.column) return refuse('the path crosses a reference; declare the shape on the entity that owns the column');
        const owner = this.outcomeOn(d, r);
        const leaf = r.leaf;
        if (leaf.kind === 'primitive' && NUMERIC_PRIMITIVES.has(leaf.name)) {
            if (d.shape === 'zipf' && !(leaf.name === 'int' || leaf.name === 'integer' || leaf.name === 'long')) return refuse('zipf ranks whole numbers; this is a decimal (use lognormal for skewed amounts)');
            const field = ast.isFieldDecl(last) ? last : undefined;
            const c = (kind: string) => field?.constraints.find(x => x.kind === kind);
            const min = c('min')?.numValue ?? c('range')?.low;
            const max = c('max')?.numValue ?? c('range')?.high;
            if (d.median !== undefined && ((min !== undefined && Number(d.median) < Number(min)) || (max !== undefined && Number(d.median) > Number(max)))) accept('error', `The median ${d.median} of ${text} lies outside its bounds [${min ?? '-∞'}, ${max ?? '∞'}].`, { node: d, property: 'median', code: 'SYN-E025' });
            if (owner?.exact) accept('warning', `The ${d.shape} shape of ${text} never applies: ${owner.exact} sets the column.`, { node: d, code: 'SYN-W013' });
            else if (owner?.sum && d.median !== undefined) accept('warning', `The median of ${text} is ignored: ${owner.sum} fixes the column's sum, so only the shape of the split (sigma) applies.`, { node: d, property: 'median', code: 'SYN-W013' });
            return;
        }
        if (leaf.kind === 'primitive' && TEMPORAL_PRIMITIVES.has(leaf.name)) {
            if (d.shape !== 'uniform') refuse('dates spread uniformly over the horizon; their periods are set with curves and rates');
            return;
        }
        if (leaf.kind === 'enum') {
            if (d.shape === 'lognormal') refuse('an enum takes zipf (over its members in declared order) or uniform');
            else if (owner?.exact) accept('warning', `The ${d.shape} shape of ${text} never applies: ${owner.exact} sets the split exactly.`, { node: d, code: 'SYN-W013' });
            return;
        }
        if (leaf.kind === 'primitive' && (leaf.name === 'string' || leaf.name === 'text')) {
            if (d.shape === 'lognormal') return refuse('text takes zipf (over its word list, first word most frequent) or uniform');
            const listed = (scenarioOf(d)?.vocabulary?.words ?? []).some(w => pathText(w.field) === text);
            if (!listed) refuse(`a text field has a shape only over its word list; add \`${text} words …\` to the vocabulary`);
            return;
        }
        refuse(`it is ${leaf.name}; shapes apply to numbers, dates, enums, word-listed text and references`);
    }

    /** The outcome that fixes a column: exactly (share, rate, mix) or by its sum (curve, total, rollup). */
    private outcomeOn(node: AstNode, r: ResolvedSynthPath): { exact?: string; sum?: string } | undefined {
        const index = this.indexOf(node);
        if (!index) return undefined;
        const same = (p: ast.SynthPath | undefined) => {
            const x = p ? index.resolvePath(p) : undefined;
            return !!x && x.root === r.root && x.column === r.column;
        };
        for (const oc of scenarioOf(node)?.outcomes?.outcomes ?? []) {
            if (ast.isShareOutcome(oc) && same(oc.dimension)) return { exact: `share ${pathText(oc.dimension)}` };
            if (ast.isRateOutcome(oc) && rateAtoms(oc.predicate).some(a => same(a.path))) return { exact: 'a rate' };
            if (ast.isMixOutcome(oc) && oc.machine?.root?.$refText === r.root.name && this.isMachineColumn(index, r)) return { exact: `mix ${pathText(oc.machine)}` };
            if ((ast.isCurveOutcome(oc) || ast.isTotalOutcome(oc)) && same(oc.measure)) return { sum: `${ast.isCurveOutcome(oc) ? 'curve' : 'total'} ${pathText(oc.measure)}` };
            if (ast.isRollupOutcome(oc) && same(oc.parts)) return { sum: `rollup ${pathText(oc.total)}` };
        }
        return undefined;
    }

    private givenOf(node: AstNode, entity: string): ast.GivenDecl | undefined {
        return scenarioOf(node)?.givens?.givens.find(g => g.entity?.$refText === entity);
    }

    /** True when `name` (an entity, first letter either case) has a population or a given. */
    private hasRows(node: AstNode, name: string): boolean {
        const scenario = scenarioOf(node);
        const is = (n: string | undefined) => !!n && n.toLowerCase() === name.toLowerCase();
        return !!scenario && (scenario.populations.populations.some(p => is(p.entity?.$refText)) || (scenario.givens?.givens ?? []).some(g => is(g.entity?.$refText)));
    }

    // -------------------------------------------------------------------- helpers

    private indexOf(node: AstNode): DomainAstIndex | undefined {
        return domainOf(node, this.documents).index;
    }

    private populationOf(node: AstNode, entity: string): ast.PopulationDecl | undefined {
        const scenario = scenarioOf(node);
        return scenario?.populations?.populations.find(p => p.entity?.$refText === entity);
    }

    /** A path that names a column of its root's own table, of the wanted kind. Reports otherwise. */
    private onTable(index: DomainAstIndex, path: ast.SynthPath, want: Want, accept: ValidationAcceptor, node: AstNode, property: string): ResolvedSynthPath | undefined {
        const r = index.resolvePath(path);
        if (!r) return undefined; // a linking error already marks the unknown segment
        const text = pathText(path);
        if (r.viaReference || !r.column) {
            const why = r.viaReference ? `crosses a reference; an outcome must pin a column of ${r.root.name}'s own table` : `names ${r.root.name} itself, not one of its fields`;
            accept('error', `Path ${text} ${why}.`, { node, property, code: 'SYN-E006' });
            return undefined;
        }
        const leaf = r.leaf;
        const ok =
            want === 'numeric'
                ? leaf.kind === 'primitive' && NUMERIC_PRIMITIVES.has(leaf.name)
                : want === 'temporal'
                  ? leaf.kind === 'primitive' && TEMPORAL_PRIMITIVES.has(leaf.name)
                  : leaf.kind === 'enum' || (leaf.kind === 'primitive' && leaf.name === 'boolean');
        if (!ok) {
            const expected = want === 'numeric' ? 'a numeric field (int, long, decimal)' : want === 'temporal' ? 'a date or datetime field' : 'an enum or boolean field';
            accept('error', `Path ${text} is ${leaf.name}; expected ${expected}.`, { node, property, code: 'SYN-E006' });
            return undefined;
        }
        return r;
    }

    /** Does a mix on the same entity drive this enum column? Then shares and rates on it are refused. */
    private isStateColumn(index: DomainAstIndex, node: AstNode, r: ResolvedSynthPath): boolean {
        if (r.leaf.kind !== 'enum' || !ast.isEnumDef(r.leaf.def)) return false;
        const scenario = scenarioOf(node);
        const mix = (scenario?.outcomes?.outcomes ?? []).find(o => ast.isMixOutcome(o) && o.machine?.root?.$refText === r.root.name) as ast.MixOutcome | undefined;
        if (!mix) return false;
        const machine = index.machineAt(mix.machine);
        if (!machine) return false;
        const members = new Set(r.leaf.def.values.map(v => v.name.toLowerCase()));
        return index.stateNamesOf(machine).some(s => members.has(s.toLowerCase()));
    }

    private checkPeriodKeys(oc: ast.CurveOutcome | ast.RateOutcome, points: Array<ast.CurvePoint | ast.RatePoint>, accept: ValidationAcceptor): void {
        const period = oc.period;
        if (!period) return;
        const scenario = scenarioOf(oc);
        const from = scenario?.horizon ? parseInstant(scenario.horizon.from) : undefined;
        const to = scenario?.horizon ? parseInstant(scenario.horizon.to) : undefined;
        const seen = new Set<string>();
        for (const p of points) {
            if (p.key === undefined) continue;
            const range = periodRange(p.key, period);
            if (!range) {
                accept('error', `"${p.key}" is not a ${period} key. Keys look like 2025-01 (month), 2025-Q1 (quarter), 2025-W03 (week), 2025-01-15 (day), 2025 (year).`, { node: p, property: 'key', code: 'SYN-E010' });
                continue;
            }
            if (from !== undefined && to !== undefined && (range.end <= from || range.start >= to)) accept('error', `Period ${p.key} lies outside the horizon.`, { node: p, property: 'key', code: 'SYN-E010' });
            if (seen.has(p.key)) accept('error', `Period ${p.key} is listed twice.`, { node: p, property: 'key', code: 'SYN-E010' });
            seen.add(p.key);
        }
        if (points.length === 0) accept('warning', 'No periods declared.', { node: oc });
    }

    private checkSumsToOne(all: Array<ast.Fraction | undefined>, node: AstNode, what: string, code: string, accept: ValidationAcceptor): void {
        const values = all.filter((f): f is ast.Fraction => !!f && f.value !== undefined);
        if (values.length === 0 || values.length !== all.length) return; // a half-parsed entry already has a syntax error
        const sum = values.reduce((s, f) => s + fraction(f), 0);
        if (Math.abs(sum - 1) > 1e-6) accept('error', `${what} sum to ${round(sum)}, not 1. Make them sum to 1, or omit a member to leave it at 0.`, { node, code });
        for (const f of values) {
            const v = fraction(f);
            if (v < 0 || v > 1) accept('error', `${f.$cstNode?.text ?? v} is outside [0, 1].`, { node: f, code });
        }
    }
}

// ------------------------------------------------------------------ pure helpers

/**
 * The built-in vocabulary packs of synthy (src/vocab/packs) and the languages
 * that name one alone. Kept identical to synthy's `builtInLocales()` and aliases.
 */
export const BUILT_IN_LOCALES = ['intl', 'en-US', 'en-GB', 'fr-FR', 'de-DE', 'es-ES', 'it-IT', 'nl-NL'];
const LOCALE_ALIASES: Record<string, string> = { en: 'en-US', fr: 'fr-FR', de: 'de-DE', es: 'es-ES', it: 'it-IT', nl: 'nl-NL', gb: 'en-GB', us: 'en-US' };

export function canonicalLocale(locale: string): string | undefined {
    const t = locale.trim().toLowerCase();
    return LOCALE_ALIASES[t] ?? BUILT_IN_LOCALES.find(k => k.toLowerCase() === t);
}

export function fraction(f: ast.Fraction): number {
    const n = Number(f.value);
    return f.percent ? n / 100 : n;
}

function round(x: number): number {
    return Math.round(x * 1e6) / 1e6;
}

function scenarioOf(node: AstNode): ast.ScenarioDef | undefined {
    let n: AstNode | undefined = node;
    while (n && !ast.isScenarioDef(n)) n = n.$container;
    return n;
}

/** Epoch millis of a date (YYYY-MM-DD) or ISO instant, UTC; undefined when unreadable. */
export function parseInstant(text: string | undefined): number | undefined {
    if (!text) return undefined;
    const t = text.trim();
    if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/.test(t)) return undefined;
    const ms = Date.parse(t.length === 10 ? `${t}T00:00:00Z` : /Z|[+-]\d{2}:\d{2}$/.test(t) ? t : `${t}Z`);
    return Number.isNaN(ms) ? undefined : ms;
}

const DAY = 86_400_000;

/** [start, end) of a period key, as synthy computes it (src/engine/periods.ts). */
export function periodRange(key: string, period: string): { start: number; end: number } | undefined {
    let m: RegExpExecArray | null;
    switch (period) {
        case 'day':
            if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)) && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31) {
                const start = Date.UTC(+m[1], +m[2] - 1, +m[3]);
                return { start, end: start + DAY };
            }
            break;
        case 'month':
            if ((m = /^(\d{4})-(\d{2})$/.exec(key)) && +m[2] >= 1 && +m[2] <= 12) return { start: Date.UTC(+m[1], +m[2] - 1, 1), end: Date.UTC(+m[1], +m[2], 1) };
            break;
        case 'quarter':
            if ((m = /^(\d{4})-Q([1-4])$/.exec(key))) {
                const q = +m[2] - 1;
                return { start: Date.UTC(+m[1], q * 3, 1), end: Date.UTC(+m[1], q * 3 + 3, 1) };
            }
            break;
        case 'year':
            if ((m = /^(\d{4})$/.exec(key))) return { start: Date.UTC(+m[1], 0, 1), end: Date.UTC(+m[1] + 1, 0, 1) };
            break;
        case 'week':
            if ((m = /^(\d{4})-W(\d{2})$/.exec(key)) && +m[2] >= 1 && +m[2] <= 53) {
                const jan4 = new Date(Date.UTC(+m[1], 0, 4));
                const dayNum = jan4.getUTCDay() || 7;
                const week1Monday = jan4.getTime() - (dayNum - 1) * DAY;
                const start = week1Monday + (+m[2] - 1) * 7 * DAY;
                return { start, end: start + 7 * DAY };
            }
            break;
    }
    return undefined;
}

/** The shapes synthy's parseDuration reads: compact (4h), spaced ("3 days"), ISO ("PT2H"). */
export function isDuration(text: string): boolean {
    const t = text.trim();
    return /^P(?:\d+(?:\.\d+)?W)?(?:\d+(?:\.\d+)?D)?(?:T(?:\d+(?:\.\d+)?H)?(?:\d+(?:\.\d+)?M)?(?:\d+(?:\.\d+)?S)?)?$/i.test(t) && t.length > 1
        || /^\d+(?:\.\d+)?\s*(ms|s|sec|secs|seconds?|min|mins|minutes?|m|h|hours?|d|days?|w|weeks?)$/i.test(t);
}

/** The atoms of a rate's predicate, left to right. */
export function rateAtoms(e: ast.RateExpr | undefined, out: ast.RatePredicate[] = []): ast.RatePredicate[] {
    if (!e) return out;
    if (ast.isRatePredicate(e)) out.push(e);
    else if (ast.isRateNot(e)) rateAtoms(e.operand, out);
    else if (ast.isRateBinary(e)) {
        rateAtoms(e.left, out);
        rateAtoms(e.right, out);
    }
    return out;
}
