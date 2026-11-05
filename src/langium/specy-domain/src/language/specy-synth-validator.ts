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
import { AstUtils, DefaultDocumentValidator, type AstNode, type LangiumCoreServices, type LangiumDocument, type LangiumDocuments, type ValidationAcceptor, type ValidationChecks, type ValidationOptions } from 'langium';
import type { Diagnostic } from 'vscode-languageserver-types';
import * as ast from '../generated/ast.js';
import type { SpecySynthServices } from './specy-synth-module.js';
import { DomainAstIndex, NUMERIC_PRIMITIVES, TEMPORAL_PRIMITIVES, domainOf, givenRowsOf, isEntityLike, isMachineStep, isRowSource, previousOf, type LeafType, type ResolvedSynthPath } from './specy-synth-domain-index.js';
import { closestName, pathText } from './specy-synth-linker.js';
import { SYNTH_KIND_NAMES, synthKind, type KindTarget } from './synth-kinds.js';

export function registerSynthValidationChecks(services: SpecySynthServices): void {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.SpecySynthValidator;
    validator.documents = services.shared.workspace.LangiumDocuments;
    const checks: ValidationChecks<ast.SpecyDomainAstType> = {
        ScenarioDef: [validator.checkDomainLoaded, validator.checkTimeline, validator.checkPopulationsDistinct, validator.checkGivensDistinct, validator.checkOutcomesDisjoint, validator.checkRuleCycles],
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
        GrammarDecl: validator.checkGrammar,
        BindingDecl: validator.checkBinding,
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
        const grammars = new Set<string>();
        for (const g of v.grammars) {
            const text = pathText(g.field);
            if (grammars.has(text)) accept('error', `${text} has two grammars.`, { node: g, property: 'field', code: 'SYN-E024' });
            else if (seen.has(text)) accept('error', `${text} has both a word list and a grammar.`, { node: g, property: 'field', code: 'SYN-E024' });
            grammars.add(text);
        }
        const bound = new Set<string>();
        for (const b of v.bindings) {
            const text = pathText(b.target);
            if (bound.has(text)) accept('error', `${text} has two bindings.`, { node: b, property: 'target', code: 'SYN-E024' });
            bound.add(text);
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

    /**
     * `Iban as iban`, `Customer.email as email`: a known kind, on a leaf it applies to
     * (a text, numeric or money-shaped field, or a value type with one such field),
     * whose minLength/maxLength leave room for what the kind produces. Any entity or
     * value type may head the path, with or without rows: synthy applies the binding
     * wherever the type occurs.
     */
    checkBinding(b: ast.BindingDecl, accept: ValidationAcceptor): void {
        if (!b.kind) return;
        const kind = synthKind(b.kind);
        if (!kind) {
            const best = closestName(b.kind, SYNTH_KIND_NAMES);
            accept('error', `Unknown kind "${b.kind}".${best ? ` Did you mean '${best}'?` : ''} Kinds: ${SYNTH_KIND_NAMES.join(', ')}.`, { node: b, property: 'kind', code: 'SYN-E024' });
            return;
        }
        const index = this.indexOf(b);
        const r = index && b.target ? index.resolvePath(b.target) : undefined;
        if (!index || !r) return; // a linking error already marks the unknown segment
        const text = pathText(b.target);
        const at = { node: b, property: 'target' as const, code: 'SYN-E024' };
        const refuse = (why: string) => accept('error', `${kind.name} applies to ${KIND_TARGETS[kind.applies]}; ${why}`, at);
        const last = r.last;
        if (r.viaReference) {
            const owner = AstUtils.getContainerOfType(last, isRowSource);
            const fix = (ast.isFieldDecl(last) || ast.isIdentityDecl(last)) && owner && !(r.leaf.kind === 'entity' || r.leaf.kind === 'collection') ? ` Bind ${owner.name}.${last.name} as ${kind.name} instead.` : '';
            return refuse(`${text} is reached through a reference.${fix}`);
        }
        const leaf = r.leaf.kind === 'collection' && r.leaf.element ? r.leaf.element : r.leaf;
        let field: ast.FieldDecl | ast.IdentityDecl | undefined;
        let fieldText = text;
        if (leaf.kind === 'entity') {
            return refuse(`${text} is an entity: name one of its fields (${text}.<field> as ${kind.name}).`);
        } else if (leaf.kind === 'value' && ast.isValueDef(leaf.def)) {
            const vt = leaf.def;
            const fields = vt.fields?.fields ?? [];
            const texts = fields.filter(f => isTextType(index.typeOf(f.type)));
            const numbers = fields.filter(f => isNumericType(index.typeOf(f.type)));
            const what = kind.applies === 'text' ? 'text' : 'numeric';
            const wanted = kind.applies === 'text' ? texts : numbers;
            const subject = last === r.root ? vt.name : `${text} (${vt.name})`;
            if (wanted.length === 0) return refuse(`${subject} has no ${what} field.`);
            if (wanted.length > 1) {
                accept('error', `${subject} has ${wanted.length} ${what} fields (${wanted.map(f => f.name).join(', ')}); name the one ${kind.name} applies to: ${text}.${wanted[0].name} as ${kind.name}.`, at);
                return;
            }
            if (kind.applies === 'money' && texts.length > 1) {
                accept('error', `money takes a value type with one numeric field (the amount) and at most one text field (the currency); ${subject} has ${texts.length} text fields (${texts.map(f => f.name).join(', ')}). Name the amount: ${text}.${wanted[0].name} as money.`, at);
                return;
            }
            field = wanted[0];
            fieldText = `${text}.${field.name}`;
        } else if (leaf.kind === 'primitive') {
            if (!(kind.applies === 'text' ? isTextType(leaf) : isNumericType(leaf))) return refuse(`${text} is ${leaf.name}.`);
            field = ast.isFieldDecl(last) || ast.isIdentityDecl(last) ? last : undefined;
        } else if (leaf.kind === 'unknown') {
            return; // a type the domain does not define here: synthy decides
        } else {
            return refuse(`${text} is ${leaf.kind === 'machine' ? 'a state machine' : leaf.kind === 'enum' ? `enum ${leaf.name}` : leaf.name}.`);
        }
        // the lengths the kind produces must meet the field's minLength..maxLength
        if (!kind.length || !ast.isFieldDecl(field)) return;
        const bound = (k: 'minLength' | 'maxLength') => {
            const v = field.constraints.find(c => c.kind === k)?.numValue;
            return v === undefined || Number.isNaN(Number(v)) ? undefined : Number(v);
        };
        const minLength = bound('minLength');
        const maxLength = bound('maxLength');
        const produces = kind.length.min === kind.length.max ? `${kind.length.min} characters` : `${kind.length.min} to ${kind.length.max} characters`;
        if (maxLength !== undefined && kind.length.min > maxLength) {
            accept('error', `${kind.name} produces ${produces}; ${fieldText} allows at most ${maxLength} (maxLength(${maxLength})).`, at);
        } else if (minLength !== undefined && kind.length.max < minLength) {
            accept('error', `${kind.name} produces ${produces}; ${fieldText} needs at least ${minLength} (minLength(${minLength})).`, at);
        }
    }

    // ------------------------------------------------------------ distributions

    checkDistributionsDistinct(b: ast.DistributionsBlock, accept: ValidationAcceptor): void {
        const seen = new Set<string>();
        for (const d of b.distributions) {
            const text = pathText(d.field);
            const key = d.when ? `${text} when ${pathText(d.when.field)} = ${scalarText(d.when.value)}` : text;
            if (seen.has(key)) accept('error', `${text} has two distributions${d.when ? ` for ${pathText(d.when.field)} = ${scalarText(d.when.value)}` : ''}.`, { node: d, property: 'field', code: 'SYN-E025' });
            seen.add(key);
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
        const whenText = d.when ? ` when ${pathText(d.when.field)} = ${scalarText(d.when.value)}` : '';
        const refuse = (why: string) => accept('error', `${d.shape} does not fit ${text}${whenText}: ${why}.`, { node: d, property: 'shape', code: 'SYN-E025' });
        if (d.shape === 'among' && d.values.length === 0) accept('error', 'among needs the values to draw from.', { node: d, property: 'shape', code: 'SYN-E025' });
        if (!this.populationOf(d, r.root.name) && !this.givenOf(d, r.root.name)) accept('error', `"${r.root.name}" has no population or given.`, { node: d, property: 'field', code: 'SYN-E003' });
        const last = r.last;
        const isReference = (ast.isReferenceDecl(last) && r.leaf.kind !== 'collection') || (ast.isFieldDecl(last) && r.leaf.kind === 'entity') || (ast.isFieldDecl(last) && r.leaf.kind === 'primitive' && r.leaf.name === 'uuid' && /Id$/.test(last.name) && this.hasRows(d, last.name.slice(0, -2)));
        if (d.when && isReference && d.field.steps.length === 1) return refuse('a reference takes a shape without a condition');
        if (d.when) {
            const read = this.readField(d, d.when.field, r, `The rule on ${text}`, accept, 'when');
            if (!read) return;
            const why = literalProblem(read.r, d.when.value);
            if (why) return void accept('error', `The rule on ${text} compares ${pathText(d.when.field)} with ${scalarText(d.when.value)}: ${why}.`, { node: d.when, property: 'value', code: 'SYN-E025' });
        }
        if (isReference && d.field.steps.length === 1) {
            if (d.shape === 'from') refuse('a reference takes uniform or zipf');
            else if (d.shape === 'lognormal' || d.shape === 'among') refuse('a reference takes uniform or zipf (some rows are referenced far more often)');
            return;
        }
        if (r.viaReference || !r.column) return refuse('the path crosses a reference; declare the shape on the entity that owns the column');
        const owner = this.outcomeOn(d, r);
        const leaf = r.leaf;
        if (d.shape === 'from') {
            const why = this.copyProblem(d, r, index);
            if (why) return refuse(why);
            if (owner?.exact) accept('warning', `The from shape of ${text}${whenText} never applies: ${owner.exact} sets the column.`, { node: d, code: 'SYN-W013' });
            else if (owner?.sum) accept('warning', `The from shape of ${text}${whenText} never applies: ${owner.sum} fixes the column's sum, which a copy cannot meet.`, { node: d, code: 'SYN-W013' });
            return;
        }
        if (d.shape === 'among') {
            const okType = leaf.kind === 'enum' || (leaf.kind === 'primitive' && (leaf.name === 'boolean' || NUMERIC_PRIMITIVES.has(leaf.name) || leaf.name === 'string' || leaf.name === 'text'));
            if (!okType) return refuse(`it is ${leaf.name}; among draws enum members, booleans, numbers or texts`);
            const weighted = d.values.filter(v => v.weight).length;
            if (weighted && weighted !== d.values.length) accept('error', `among on ${text}: give every value a weight, or none.`, { node: d, property: 'values', code: 'SYN-E025' });
            const field = ast.isFieldDecl(last) ? last : undefined;
            const c = (kind: string) => field?.constraints.find(x => x.kind === kind);
            const min = c('min')?.numValue ?? c('range')?.low;
            const max = c('max')?.numValue ?? c('range')?.high;
            const seen = new Set<string>();
            let sum = 0;
            d.values.forEach((v, i) => {
                const why = literalProblem(r, v.value);
                const key = scalarText(v.value);
                if (why) accept('error', `among on ${text}: ${why}.`, { node: d, property: 'values', index: i, code: 'SYN-E025' });
                else if (v.value.number !== undefined && ((min !== undefined && Number(v.value.number) < Number(min)) || (max !== undefined && Number(v.value.number) > Number(max)))) accept('error', `among on ${text}: ${key} lies outside its bounds [${min ?? '-∞'}, ${max ?? '∞'}].`, { node: d, property: 'values', index: i, code: 'SYN-E025' });
                if (seen.has(key)) accept('error', `among on ${text} lists ${key} twice.`, { node: d, property: 'values', index: i, code: 'SYN-E025' });
                seen.add(key);
                if (v.weight) sum += Number(v.weight.value) / (v.weight.percent ? 100 : 1);
            });
            if (weighted === d.values.length && weighted && Math.abs(sum - 1) > 1e-6) accept('error', `among on ${text}: the weights sum to ${Math.round(sum * 1e6) / 1e6}, not 1.`, { node: d, property: 'values', code: 'SYN-E025' });
            if (owner?.exact) accept('warning', `The among shape of ${text}${whenText} never applies: ${owner.exact} sets the column.`, { node: d, code: 'SYN-W013' });
            else if (owner?.sum) accept('warning', `The among shape of ${text}${whenText} never applies: ${owner.sum} fixes the column's sum, which fixed values cannot meet.`, { node: d, code: 'SYN-W013' });
            return;
        }
        if (leaf.kind === 'primitive' && NUMERIC_PRIMITIVES.has(leaf.name)) {
            if (d.shape === 'zipf' && !(leaf.name === 'int' || leaf.name === 'integer' || leaf.name === 'long')) return refuse('zipf ranks whole numbers; this is a decimal (use lognormal for skewed amounts)');
            const field = ast.isFieldDecl(last) ? last : undefined;
            const c = (kind: string) => field?.constraints.find(x => x.kind === kind);
            const min = c('min')?.numValue ?? c('range')?.low;
            const max = c('max')?.numValue ?? c('range')?.high;
            if (d.median !== undefined && ((min !== undefined && Number(d.median) < Number(min)) || (max !== undefined && Number(d.median) > Number(max)))) accept('error', `The median ${d.median} of ${text} lies outside its bounds [${min ?? '-∞'}, ${max ?? '∞'}].`, { node: d, property: 'median', code: 'SYN-E025' });
            if (owner?.exact) accept('warning', `The ${d.shape} shape of ${text}${whenText} never applies: ${owner.exact} sets the column.`, { node: d, code: 'SYN-W013' });
            else if (owner?.sum && d.median !== undefined) accept('warning', `The median of ${text}${whenText} is ignored: ${owner.sum} fixes the column's sum, so only the shape of the split (sigma) applies.`, { node: d, property: 'median', code: 'SYN-W013' });
            return;
        }
        if (leaf.kind === 'primitive' && TEMPORAL_PRIMITIVES.has(leaf.name)) {
            if (d.shape !== 'uniform') refuse('dates spread uniformly over the horizon; their periods are set with curves and rates');
            return;
        }
        if (leaf.kind === 'enum') {
            if (d.shape === 'lognormal') refuse('an enum takes zipf (over its members in declared order), uniform, or among');
            else if (owner?.exact) accept('warning', `The ${d.shape} shape of ${text}${whenText} never applies: ${owner.exact} sets the split exactly.`, { node: d, code: 'SYN-W013' });
            return;
        }
        if (leaf.kind === 'primitive' && (leaf.name === 'string' || leaf.name === 'text')) {
            if (d.shape === 'lognormal') return refuse('text takes zipf (over its word list, first word most frequent), uniform, or among');
            const listed = (scenarioOf(d)?.vocabulary?.words ?? []).some(w => pathText(w.field) === text);
            if (!listed) refuse(`a text field has a shape only over its word list; add \`${text} words …\` to the vocabulary`);
            return;
        }
        refuse(`it is ${leaf.name}; shapes apply to numbers, dates, enums, word-listed text and references`);
    }

    /**
     * `Order.shippingAddress from Order.customer.shippingAddress`: the source is a
     * path from the same entity through exactly one declared reference (a reference
     * or an entity-typed field, not a key synthy infers, not a collection) to a
     * field of the target whose type is the field's own: the same primitive, the
     * same value type (copied whole), the same enum. Why a copy is refused, or
     * undefined when it fits.
     */
    private copyProblem(d: ast.DistributionDecl, r: ResolvedSynthPath, index: DomainAstIndex): string | undefined {
        if (ast.isIdentityDecl(r.last)) return 'the identity is not copied';
        const s = index.resolvePath(d.source);
        if (!s) return undefined; // a linking error already marks the unknown segment
        if (s.root !== r.root) return `the source is a path from ${s.root.name}, not from ${r.root.name}`;
        if (s.hops.length === 0) return 'the source stays on the row; a copy reads through a reference (Order.customer.shippingAddress)';
        if (s.hops.length > 1) return 'the source crosses two references; one is read';
        if (s.hops[0].inferred) return 'the source is an inferred key; a declared reference is read';
        if (s.hops[0].collection || s.leaf.kind === 'collection') return 'a collection is not copied';
        const same = s.leaf.kind === r.leaf.kind && (s.leaf.kind === 'primitive' ? s.leaf.name === r.leaf.name : s.leaf.def !== undefined && s.leaf.def === r.leaf.def);
        if (!same) return `the source is a ${s.leaf.name} while the field is a ${r.leaf.name}`;
        return undefined;
    }

    /**
     * `Book.title grammar "titles.json" by Book.genre`: a text field of a row source
     * with rows; `by` a field the row (or its per parent) stores, read before the
     * title is drawn. The file's symbols are synthy's to check (SYN-E024 at check).
     */
    checkGrammar(g: ast.GrammarDecl, accept: ValidationAcceptor): void {
        const index = this.indexOf(g);
        if (!index || !g.field) return;
        const r = index.resolvePath(g.field);
        if (!r) return;
        const text = pathText(g.field);
        if (!this.populationOf(g, r.root.name) && !this.givenOf(g, r.root.name)) accept('error', `"${r.root.name}" has no population or given.`, { node: g, property: 'field', code: 'SYN-E003' });
        const leaf = r.leaf.kind === 'collection' && r.leaf.element ? r.leaf.element : r.leaf;
        if (r.viaReference || !(leaf.kind === 'primitive' && (leaf.name === 'string' || leaf.name === 'text'))) {
            accept('error', `A grammar applies to a text field; ${text} is ${r.viaReference ? 'reached through a reference' : r.leaf.name}.`, { node: g, property: 'field', code: 'SYN-E024' });
            return;
        }
        if (g.by) this.readField(g, g.by, r, `The grammar of ${text}`, accept, 'by');
    }

    /**
     * The conditional rules and grammars of one entity read each other in a cycle
     * (A reads B, B reads A): no order draws each field after the ones it reads.
     */
    checkRuleCycles(s: ast.ScenarioDef, accept: ValidationAcceptor): void {
        const index = this.indexOf(s);
        if (!index) return;
        const edges = new Map<string, { from: string; to: string; node: AstNode }[]>();
        const add = (field: ast.SynthPath | undefined, read: ast.SynthPath | undefined, node: AstNode) => {
            const t = index.resolvePath(field);
            const r = index.resolvePath(read);
            // segments carry the root first: the top-level field is the second; a rule reading its own value is refused elsewhere;
            // a read through a reference (and a copy) is no edge inside the entity: the referenced row is complete when it is read
            if (!t || !r || t.root !== r.root || r.viaReference || t.segments.length < 2 || r.segments.length < 2 || t.segments[1] === r.segments[1]) return;
            const list = edges.get(t.root.name) ?? [];
            list.push({ from: r.segments[1], to: t.segments[1], node });
            edges.set(t.root.name, list);
        };
        for (const d of s.distributions?.distributions ?? []) if (d.when) add(d.field, d.when.field, d);
        for (const g of s.vocabulary?.grammars ?? []) if (g.by) add(g.field, g.by, g);
        for (const [entity, list] of edges) {
            const nodes = [...new Set(list.flatMap(e => [e.from, e.to]))];
            const after = new Map<string, Set<string>>();
            for (const e of list) {
                if (e.from === e.to) continue;
                const set = after.get(e.to) ?? new Set<string>();
                set.add(e.from);
                after.set(e.to, set);
            }
            const placed = new Set<string>();
            let progress = true;
            while (placed.size < nodes.length && progress) {
                progress = false;
                for (const n of nodes) {
                    if (placed.has(n)) continue;
                    const deps = after.get(n);
                    if (deps && [...deps].some(x => !placed.has(x))) continue;
                    placed.add(n);
                    progress = true;
                }
            }
            if (placed.size === nodes.length) continue;
            const stuck = list.filter(e => !placed.has(e.from) && !placed.has(e.to));
            const why = stuck.map(e => `${e.to} reads ${e.from}`).join(', ');
            for (const e of stuck) accept('error', `The rules on ${entity} read each other in a cycle: ${why}.`, { node: e.node, code: 'SYN-E026' });
        }
    }

    /**
     * A field a rule or a grammar reads: of the row's own entity or of its per
     * parent, directly or through one declared reference (never an inferred key,
     * never two), an enum, boolean, whole-number or text column of that table, and
     * not inside the very value the rule decides (the fields of one value are
     * drawn together). Reports with SYN-E025.
     */
    private readField(node: AstNode, path: ast.SynthPath, target: ResolvedSynthPath, what: string, accept: ValidationAcceptor, property: string): { r: ResolvedSynthPath; parent: boolean } | undefined {
        const index = this.indexOf(node);
        if (!index) return undefined;
        const r = index.resolvePath(path);
        if (!r) return undefined;
        const text = pathText(path);
        const parentName = this.populationOf(node, target.root.name)?.parent?.$refText;
        const parent = r.root !== target.root && !!parentName && r.root.name === parentName;
        const at = { node, property, code: 'SYN-E025' };
        if (r.root !== target.root && !parent) {
            accept('error', `${what} reads ${text}, which is not a field of ${target.root.name}${parentName ? ` nor of its parent ${parentName}` : ''}.`, at);
            return undefined;
        }
        const last = r.last;
        if ((ast.isReferenceDecl(last) && r.leaf.kind !== 'collection') || (ast.isFieldDecl(last) && r.leaf.kind === 'entity')) {
            accept('error', `${what} reads ${text}, a reference.`, at);
            return undefined;
        }
        // one declared reference may be crossed: the referenced row's value is read after the reference is chosen
        if (r.hops.length > 1) {
            accept('error', `${what} reads ${text}, which crosses two references.`, at);
            return undefined;
        }
        if (r.hops.some(h => h.inferred)) {
            accept('error', `${what} reads ${text}, through an inferred key; a declared reference is read.`, at);
            return undefined;
        }
        if (r.hops.some(h => h.collection)) {
            accept('error', `${what} reads ${text}, through a collection.`, at);
            return undefined;
        }
        if (!r.viaReference && !r.column) {
            accept('error', `${what} reads ${text}, which crosses a reference.`, at);
            return undefined;
        }
        const leaf = r.leaf;
        const readable = leaf.kind === 'enum' || (leaf.kind === 'primitive' && ['boolean', 'string', 'text', 'int', 'integer', 'long'].includes(leaf.name));
        if (!readable) {
            accept('error', `${what} reads ${text}, a ${leaf.name}: conditions read enums, booleans, whole numbers and text.`, at);
            return undefined;
        }
        // segments carry the root first: the top-level field is the second
        if (!parent && r.segments[1] !== undefined && r.segments[1] === target.segments[1]) {
            accept('error', `${what} reads ${text}, inside the value it decides.`, at);
            return undefined;
        }
        return { r, parent };
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

/** What a kind applies to, as SYN-E024 says it. */
const KIND_TARGETS: Record<KindTarget, string> = {
    text: 'text fields, or a value type with one text field',
    number: 'numeric fields, or a value type with one numeric field',
    money: 'numeric fields, or a value type with one numeric field (the amount) and at most one text field (the currency)',
};

function isTextType(t: LeafType): boolean {
    return t.kind === 'primitive' && (t.name === 'string' || t.name === 'text');
}

function isNumericType(t: LeafType): boolean {
    return t.kind === 'primitive' && NUMERIC_PRIMITIVES.has(t.name);
}

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

/** A condition's or an among's value as written: the member, the text, the number or the boolean. */
export function scalarText(v: ast.ScalarValue | undefined): string {
    if (!v) return '';
    if (v.text !== undefined) return v.text;
    if (v.bool !== undefined) return v.bool;
    if (v.number !== undefined) return v.number;
    return v.member ?? '';
}

/** Why a value is not one the field can hold, or undefined when it is. */
function literalProblem(r: ResolvedSynthPath, v: ast.ScalarValue | undefined): string | undefined {
    const leaf = r.leaf;
    const text = scalarText(v);
    if (leaf.kind === 'enum' && ast.isEnumDef(leaf.def)) {
        const members = leaf.def.values.map(m => m.name);
        return members.includes(text) ? undefined : `${text} is not a member of ${leaf.def.name} (${members.join(', ')})`;
    }
    if (leaf.kind === 'primitive') {
        if (leaf.name === 'boolean') return v?.bool !== undefined || text === 'true' || text === 'false' ? undefined : `${JSON.stringify(text)} is not a boolean`;
        if (NUMERIC_PRIMITIVES.has(leaf.name)) {
            const n = Number(text);
            if (text.trim() === '' || !Number.isFinite(n)) return `${JSON.stringify(text)} is not a number`;
            if ((leaf.name === 'int' || leaf.name === 'integer' || leaf.name === 'long') && !Number.isInteger(n)) return `${n} is not a whole number`;
            return undefined;
        }
        if (leaf.name === 'string' || leaf.name === 'text') return undefined;
    }
    return `${leaf.name} is neither an enum, a boolean, a number nor text`;
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
