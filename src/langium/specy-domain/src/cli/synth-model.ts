/**
 * Normalizer: .synth AST -> the scenario JSON synthy consumes.
 *
 * The shape is synthy's `Scenario` (src/scenario/model.ts): populations as
 * `{ entity, count }` or `{ entity, per, exactly | min, max }`, outcomes with a
 * `kind` discriminator and `values` maps, givens, vocabulary, distributions,
 * options. It opens with
 * `$schema` (src/schemas/synth-scenario.schema.json, the same document stored as
 * JSON or YAML) and a `parser` header, like the domain JSON, and carries
 * `domain`, the model the scenario was written against, relative to the .synth file.
 *
 * Percentages become fractions (72% -> 0.72); numbers are numbers; dot-paths
 * are the text as written, since synthy resolves them again on its own index.
 * Keys come in the canonical order synthy's writer also uses (kind and name
 * first, the outcome's own fields in .synth order, description and satisfies
 * last), so the parser and synthy write the same bytes for the same scenario.
 */
import * as ast from '../generated/ast.js';
import { PARSER_VERSION, SYNTH_SCENARIO_SCHEMA } from './version.js';

export interface ScenarioJson {
    $schema: string;
    parser: { name: string; version: string };
    name: string;
    description?: string;
    domain: string;
    requirementsSource?: string;
    seed?: string | number;
    horizon?: { from: string; to: string };
    asOf?: string;
    populations: Record<string, unknown>[];
    outcomes?: Record<string, unknown>[];
    givens?: Record<string, unknown>[];
    vocabulary?: Record<string, unknown>;
    distributions?: Record<string, unknown>[];
    options?: Record<string, unknown>;
}

export function normalizeScenario(file: ast.SynthFile): ScenarioJson {
    const s = file.scenario;
    if (!s) return { $schema: SYNTH_SCENARIO_SCHEMA, parser: header(), name: '', domain: '', populations: [] };
    return compact({
        $schema: SYNTH_SCENARIO_SCHEMA,
        parser: header(),
        name: s.name,
        description: s.description?.text,
        domain: s.domainSource?.path,
        requirementsSource: s.requirementsSource?.path,
        satisfies: ids(s.satisfies),
        seed: s.seed ? (s.seed.number !== undefined ? numberOf(s.seed.number) : s.seed.text) : undefined,
        horizon: s.horizon ? { from: s.horizon.from, to: s.horizon.to } : undefined,
        asOf: s.asOf?.instant,
        populations: (s.populations?.populations ?? []).map(population),
        outcomes: s.outcomes ? s.outcomes.outcomes.map(outcome) : undefined,
        givens: s.givens ? s.givens.givens.map(given) : undefined,
        vocabulary: s.vocabulary ? vocabulary(s.vocabulary) : undefined,
        distributions: s.distributions && s.distributions.distributions.length ? s.distributions.distributions.map(distribution) : undefined,
        options: s.options ? options(s.options) : undefined,
    }) as ScenarioJson;
}

function header() {
    return { name: 'specy-synth', version: PARSER_VERSION };
}

function population(p: ast.PopulationDecl): Record<string, unknown> {
    const base: Record<string, unknown> = { entity: p.entity?.$refText };
    if (p.count !== undefined) base.count = numberOf(p.count);
    if (p.parent) {
        base.per = p.parent.$refText;
        if (p.exactly !== undefined) base.exactly = numberOf(p.exactly);
        if (p.range !== undefined) {
            const [min, max] = p.range.split('..');
            base.min = numberOf(min);
            base.max = /[nN]/.test(max) ? undefined : numberOf(max);
        }
    }
    base.since = p.since;
    base.clock = p.clock?.$refText;
    base.description = p.description?.text;
    return compact(base);
}

function outcome(o: ast.OutcomeDecl): Record<string, unknown> {
    if (ast.isCurveOutcome(o)) {
        const counts = o.points.every(p => p.rows !== undefined) && o.points.length > 0 ? Object.fromEntries(o.points.map(p => [p.key, numberOf(p.rows!)])) : undefined;
        return compact({ kind: 'curve', name: o.name, measure: path(o.measure), by: path(o.by), period: o.period, alpha: opt(o.alpha), values: Object.fromEntries(o.points.map(p => [p.key, numberOf(p.value)])), counts, description: o.description?.text, satisfies: ids(o.satisfies) });
    }
    if (ast.isTotalOutcome(o)) {
        return compact({ kind: 'total', name: o.name, measure: path(o.measure), value: numberOf(o.value), alpha: opt(o.alpha), description: o.description?.text, satisfies: ids(o.satisfies) });
    }
    if (ast.isShareOutcome(o)) {
        const split = (entries: ast.ShareEntry[]) => Object.fromEntries(entries.map(e => [e.member?.$refText ?? e.literal, fraction(e.value)]));
        const values = o.given ? Object.fromEntries(o.groups.map(g => [g.member?.$refText ?? g.literal, split(g.shares)])) : split(o.shares);
        return compact({ kind: 'share', name: o.name, dimension: path(o.dimension), given: o.given ? path(o.given) : undefined, values, description: o.description?.text, satisfies: ids(o.satisfies) });
    }
    if (ast.isMixOutcome(o)) {
        return compact({ kind: 'mix', name: o.name, machine: path(o.machine), values: Object.fromEntries(o.states.map(e => [e.state?.$refText, fraction(e.value)])), description: o.description?.text, satisfies: ids(o.satisfies) });
    }
    if (ast.isRateOutcome(o)) {
        const predicate = ratePredicate(o.predicate);
        if (o.value) return compact({ kind: 'rate', name: o.name, predicate, values: fraction(o.value), description: o.description?.text, satisfies: ids(o.satisfies) });
        return compact({ kind: 'rate', name: o.name, predicate, by: o.by ? path(o.by) : undefined, period: o.period, values: Object.fromEntries(o.points.map(pt => [pt.key, fraction(pt.value)])), description: o.description?.text, satisfies: ids(o.satisfies) });
    }
    return compact({ kind: 'rollup', name: o.name, total: path(o.total), parts: path(o.parts), description: o.description?.text, satisfies: ids(o.satisfies) });
}

function given(g: ast.GivenDecl): Record<string, unknown> {
    return compact({
        entity: g.entity?.$refText,
        rows: g.csv === undefined && g.json === undefined ? g.rows.map(row) : undefined,
        csv: g.csv,
        json: g.json,
        columns: g.columns.length ? Object.fromEntries(g.columns.map(c => [c.steps.map(st => st.target?.$refText ?? '').join('.'), c.source])) : undefined,
        description: g.description?.text,
    });
}

function vocabulary(v: ast.VocabularyBlock): Record<string, unknown> | undefined {
    const out = compact({
        locale: v.locale,
        pack: v.pack,
        words: v.words.length
            ? v.words.map(w => compact({ field: path(w.field), file: w.file, values: w.file === undefined ? [...w.values] : undefined, description: w.description?.text }))
            : undefined,
    });
    return Object.keys(out).length ? out : undefined;
}

function distribution(d: ast.DistributionDecl): Record<string, unknown> {
    return compact({ field: path(d.field), shape: d.shape, median: opt(d.median), sigma: opt(d.sigma), exponent: opt(d.exponent), description: d.description?.text });
}

function row(r: ast.RowLiteral): Record<string, unknown> {
    return Object.fromEntries(r.entries.map(e => [e.key, rowValue(e.value)]));
}

function rowValue(v: ast.RowValue): unknown {
    if (ast.isRowString(v)) return v.value;
    if (ast.isRowNumber(v)) return numberOf(v.value);
    if (ast.isRowBoolean(v)) return v.value === 'true';
    if (ast.isRowNull(v)) return null;
    if (ast.isRowArray(v)) return v.items.map(rowValue);
    return row(v);
}

/**
 * A rate's predicate in the one spelling synthy writes back (src/scenario/predicate.ts):
 * single spaces, `not X`, parentheses only where an `or` sits under an `and` or a `not`,
 * or an `and` under a `not`.
 */
export function ratePredicate(e: ast.RateExpr | undefined, parent?: 'and' | 'or' | 'not'): string {
    if (!e) return '';
    if (ast.isRatePredicate(e)) {
        const value = e.member ? e.member.$refText : e.literal;
        return value === undefined ? path(e.path) : `${path(e.path)} ${e.op ?? '='} ${value}`;
    }
    if (ast.isRateNot(e)) return `not ${ratePredicate(e.operand, 'not')}`;
    const k = e.op as 'and' | 'or';
    const s = `${ratePredicate(e.left, k)} ${k} ${ratePredicate(e.right, k)}`;
    return parent === 'not' || (parent === 'and' && k === 'or') ? `(${s})` : s;
}

/** Options in the canonical key order (alpha, decimals, nullRate, defaultDwell, dwell, reactionLatency, rejections), whatever order the text uses. */
function options(o: ast.OptionsBlock): Record<string, unknown> {
    const out: Record<string, unknown> = { alpha: undefined, decimals: undefined, nullRate: undefined, defaultDwell: undefined, dwell: undefined, reactionLatency: undefined, rejections: undefined };
    for (const e of o.entries) {
        if (ast.isAlphaOption(e)) out.alpha = numberOf(e.value);
        else if (ast.isDecimalsOption(e)) out.decimals = numberOf(e.value);
        else if (ast.isNullRateOption(e)) out.nullRate = fraction(e.value);
        else if (ast.isDefaultDwellOption(e)) out.defaultDwell = e.value;
        else if (ast.isReactionLatencyOption(e)) out.reactionLatency = e.value;
        else if (ast.isRejectionsOption(e)) out.rejections = numberOf(e.value);
        else if (ast.isDwellBlock(e)) {
            const dwell: Record<string, string> = (out.dwell as Record<string, string>) ?? {};
            for (const d of e.entries) dwell[`${d.from}->${d.to}`] = d.duration;
            out.dwell = dwell;
        }
    }
    return compact(out);
}

/** The path as written: synthy resolves it on its own index. */
export function path(p: ast.SynthPath | undefined): string {
    if (!p) return '';
    return [p.root?.$refText ?? '', ...p.steps.map(s => s.target?.$refText ?? '')].join('.');
}

function fraction(f: ast.Fraction | undefined): number {
    const n = numberOf(f?.value);
    return f?.percent ? n / 100 : n;
}

function numberOf(text: string | undefined): number {
    return Number(text);
}

function opt(text: string | undefined): number | undefined {
    return text === undefined ? undefined : numberOf(text);
}

function ids(s: ast.SatisfiesDecl | undefined): string[] | undefined {
    return s && s.ids.length ? [...s.ids] : undefined;
}

function compact<T extends Record<string, unknown>>(o: T): T {
    for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k];
    return o;
}
