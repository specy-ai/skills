/**
 * DSL printer for the scenario document: the inverse of the normalizer
 * (cli/synth-model.ts). `printScenario(doc)` writes a `.synth` text that the
 * parser reads back into the same document — the round trip the tests pin on
 * every example scenario.
 *
 * The document is synthy's interchange JSON, so the printer reads what synthy
 * writes: fractions (0.72, not 72%), `counts` beside a curve's `values`, a
 * share's `values` nested one level when `given` splits it, a rate's predicate
 * as text in the one spelling both tools use, dwell keys as `from->to`.
 * Fractions are printed as percentages when the percentage is exact (72%),
 * else as the fraction itself: both spellings are the same number to the parser.
 */
import type { ScenarioJson } from '../../cli/synth-model.js';
import { IndentWriter, describe, isIdent, quote, satisfiesInline, satisfiesLine } from '../kit/dsl.js';

type Rec = Record<string, unknown>;

export function printScenario(doc: ScenarioJson): string {
    const d = doc as ScenarioJson & Rec;
    const w = new IndentWriter('    ');
    w.block(`scenario ${d.name}${describe(d.description)}`, () => {
        satisfiesLine(w, d.satisfies as string[] | undefined);
        w.line(`domain-source ${quote(d.domain)}`);
        if (d.requirementsSource) w.line(`requirements-source ${quote(d.requirementsSource)}`);
        if (d.seed !== undefined) w.line(`seed ${typeof d.seed === 'number' ? num(d.seed) : quote(d.seed)}`);
        if (d.horizon) w.line(`horizon ${dateToken(d.horizon.from)} .. ${dateToken(d.horizon.to)}`);
        if (d.asOf) w.line(`as-of ${instantToken(d.asOf)}`);
        w.blank();
        w.block('populations', () => {
            for (const p of d.populations ?? []) w.line(populationLine(p));
        });
        if (d.outcomes?.length) {
            w.blank();
            w.block('outcomes', () => {
                for (const o of d.outcomes!) printOutcome(w, o);
            });
        }
        if (d.givens?.length) {
            w.blank();
            w.block('givens', () => {
                for (const g of d.givens!) printGiven(w, g);
            });
        }
        if (d.vocabulary) {
            w.blank();
            printVocabulary(w, d.vocabulary);
        }
        if (d.distributions?.length) {
            w.blank();
            w.block('distributions', () => {
                for (const dist of d.distributions!) w.line(distributionLine(dist));
            });
        }
        if (d.options && Object.keys(d.options).length) {
            w.blank();
            printOptions(w, d.options);
        }
    });
    return w.toString();
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

/** A number as the NUMBER terminal reads it (no exponent). */
export function num(n: unknown): string {
    const v = typeof n === 'number' ? n : Number(n);
    if (!Number.isFinite(v)) return quote(String(n));
    const s = String(v);
    return /^-?\d+(\.\d+)?$/.test(s) ? s : v.toFixed(12).replace(/\.?0+$/, '');
}

/**
 * A fraction as a percentage when that is exact (`0.72` -> `72%`), else as it
 * is. `fraction()` in the normalizer divides by 100, so the test is that the
 * division gives back the very same number.
 */
export function pct(f: unknown): string {
    const v = typeof f === 'number' ? f : Number(f);
    if (!Number.isFinite(v)) return num(f);
    const p = Number((v * 100).toPrecision(12));
    return p / 100 === v && /^-?\d+(\.\d+)?$/.test(String(p)) ? `${p}%` : num(v);
}

/** `2025-01-01` bare (the DATE terminal), anything else quoted. */
export function dateToken(s: unknown): string {
    const t = String(s ?? '');
    return /^\d{4}-\d{2}(-\d{2})?$/.test(t) ? t : quote(t);
}

export function instantToken(s: unknown): string {
    const t = String(s ?? '');
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/.test(t) || /^\d{4}-\d{2}(-\d{2})?$/.test(t) ? t : quote(t);
}

/** `4h`, `2d`, `45min` bare (the DURATION terminal), anything else quoted. */
export function durationToken(s: unknown): string {
    const t = String(s ?? '');
    return /^\d+(\.\d+)?(ms|min|s|h|d|w)$/.test(t) ? t : quote(t);
}

/** A period key: `2025-01`, `2025-01-15`, `2025-Q1`, `2025-W03`, `2025` — all bare tokens. */
function periodKey(k: string): string {
    return /^\d{4}(-(\d{2}(-\d{2})?|W\d{2}|Q[1-4]))?$/.test(k) ? k : quote(k);
}

/** A member of an enum or a boolean literal, as a share/mix/rate entry key. */
function memberToken(k: string): string {
    return k;
}

/** A row key: an identifier, else quoted. A few keywords cannot be identifiers here. */
function rowKey(k: string): string {
    return isIdent(k) && !/^(satisfies|true|false|null|and|or|not)$/.test(k) ? k : quote(k);
}

// ---------------------------------------------------------------------------
// Populations
// ---------------------------------------------------------------------------

export function populationLine(p: Rec): string {
    const parts = [String(p.entity)];
    if (p.per !== undefined) {
        parts.push(`per ${p.per}`);
        if (p.exactly !== undefined) parts.push(`exactly ${num(p.exactly)}`);
        else parts.push(`${num(p.min ?? 1)}..${p.max === undefined ? 'n' : num(p.max)}`);
    } else {
        parts.push(`count ${num(p.count ?? 0)}`);
        if (p.since !== undefined) parts.push(`since ${dateToken(p.since)}`);
    }
    if (p.clock !== undefined) parts.push(`clock ${p.clock}`);
    return parts.join(' ') + describe(p.description as string | undefined);
}

// ---------------------------------------------------------------------------
// Outcomes
// ---------------------------------------------------------------------------

function named(o: Rec): string {
    return o.name ? ` ${o.name}` : '';
}

function alpha(o: Rec): string {
    return o.alpha !== undefined ? ` alpha ${num(o.alpha)}` : '';
}

export function printOutcome(w: IndentWriter, o: Rec): void {
    const sat = o.satisfies as string[] | undefined;
    const desc = describe(o.description as string | undefined);
    switch (o.kind) {
        case 'curve': {
            const values = (o.values as Record<string, unknown>) ?? {};
            const counts = o.counts as Record<string, unknown> | undefined;
            w.block(`curve${named(o)} ${o.measure} by ${o.by} per ${o.period}${alpha(o)}${desc}`, () => {
                satisfiesLine(w, sat);
                for (const [k, v] of Object.entries(values)) {
                    w.line(`${periodKey(k)}: ${num(v)}${counts && counts[k] !== undefined ? ` over ${num(counts[k])} rows` : ''}`);
                }
            });
            return;
        }
        case 'total':
            w.line(`total${named(o)} ${o.measure} = ${num(o.value)}${alpha(o)}${desc}${satisfiesInline(sat)}`);
            return;
        case 'share': {
            const values = (o.values as Record<string, unknown>) ?? {};
            w.block(`share${named(o)} ${o.dimension}${o.given ? ` given ${o.given}` : ''}${desc}`, () => {
                satisfiesLine(w, sat);
                for (const [k, v] of Object.entries(values)) {
                    if (v && typeof v === 'object') {
                        const inner = Object.entries(v as Record<string, unknown>)
                            .map(([m, f]) => `${memberToken(m)}: ${pct(f)}`)
                            .join(', ');
                        w.line(`${memberToken(k)}: { ${inner} }`);
                    } else {
                        w.line(`${memberToken(k)}: ${pct(v)}`);
                    }
                }
            });
            return;
        }
        case 'mix': {
            const values = (o.values as Record<string, unknown>) ?? {};
            w.block(`mix${named(o)} ${o.machine}${desc}`, () => {
                satisfiesLine(w, sat);
                for (const [k, v] of Object.entries(values)) w.line(`${memberToken(k)}: ${pct(v)}`);
            });
            return;
        }
        case 'rate': {
            if (o.values !== null && typeof o.values === 'object') {
                const values = o.values as Record<string, unknown>;
                w.block(`rate${named(o)} ${o.predicate} by ${o.by} per ${o.period}${desc}`, () => {
                    satisfiesLine(w, sat);
                    for (const [k, v] of Object.entries(values)) w.line(`${periodKey(k)}: ${pct(v)}`);
                });
            } else {
                w.line(`rate${named(o)} ${o.predicate} : ${pct(o.values)}${desc}${satisfiesInline(sat)}`);
            }
            return;
        }
        case 'rollup':
            w.line(`rollup${named(o)} ${o.total} from ${o.parts}${desc}${satisfiesInline(sat)}`);
            return;
        default:
            w.comment(`unprintable outcome ${JSON.stringify(o)}`);
    }
}

/** One outcome as text, for a Markdown island. */
export function outcomeIsland(o: Rec): string {
    const w = new IndentWriter('    ');
    printOutcome(w, o);
    return w.toString();
}

// ---------------------------------------------------------------------------
// Givens
// ---------------------------------------------------------------------------

export function rowLiteral(row: Rec): string {
    const entries = Object.entries(row).map(([k, v]) => `${rowKey(k)}: ${rowValue(v)}`);
    return entries.length ? `{ ${entries.join(', ')} }` : '{ }';
}

export function rowValue(v: unknown): string {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'number') return num(v);
    if (typeof v === 'boolean') return String(v);
    if (typeof v === 'string') return quote(v);
    if (Array.isArray(v)) return v.length ? `[ ${v.map(rowValue).join(', ')} ]` : '[ ]';
    return rowLiteral(v as Rec);
}

export function printGiven(w: IndentWriter, g: Rec): void {
    const source =
        g.csv !== undefined ? `csv ${quote(String(g.csv))}` : g.json !== undefined ? `json ${quote(String(g.json))}` : undefined;
    const columns = g.columns as Record<string, string> | undefined;
    const head = `${g.entity} `;
    const body = () => {
        for (const [path, src] of Object.entries(columns ?? {})) w.line(`${path} from ${quote(src)}`);
    };
    if (source) {
        const line = `${head}${source}${describe(g.description as string | undefined)}`;
        if (columns && Object.keys(columns).length) w.block(line, body);
        else w.line(line);
        return;
    }
    const rows = (g.rows as Rec[]) ?? [];
    const desc = describe(g.description as string | undefined);
    if (!rows.length) {
        const line = `${head}rows [ ]${desc}`;
        if (columns && Object.keys(columns).length) w.block(line, body);
        else w.line(line);
        return;
    }
    w.line(`${head}rows [`);
    // raw() indents at the current depth; one more indent string puts the rows inside the brackets
    w.raw(rows.map((r, i) => `${w.indent}${rowLiteral(r)}${i < rows.length - 1 ? ',' : ''}`).join('\n'));
    if (columns && Object.keys(columns).length) w.block(`]${desc}`, body);
    else w.line(`]${desc}`);
}

// ---------------------------------------------------------------------------
// Vocabulary, distributions, options
// ---------------------------------------------------------------------------

export function wordListLine(wd: Rec): string {
    const values = wd.file !== undefined ? quote(String(wd.file)) : `[ ${((wd.values as string[]) ?? []).map(v => quote(v)).join(', ')} ]`;
    return `${wd.field} words ${values}${describe(wd.description as string | undefined)}`;
}

export function bindingLine(b: Rec): string {
    return `${b.target} as ${b.kind}${describe(b.description as string | undefined)}`;
}

export function printVocabulary(w: IndentWriter, v: Rec): void {
    w.block('vocabulary', () => {
        if (v.locale !== undefined) w.line(`locale ${isIdent(String(v.locale)) ? v.locale : quote(String(v.locale))}`);
        if (v.pack !== undefined) w.line(`pack ${quote(String(v.pack))}`);
        for (const wd of (v.words as Rec[]) ?? []) w.line(wordListLine(wd));
        for (const b of (v.bindings as Rec[]) ?? []) w.line(bindingLine(b));
    });
}

export function distributionShape(d: Rec): string {
    const parts = [String(d.shape)];
    if (d.shape === 'lognormal') {
        if (d.median !== undefined) parts.push(`median ${num(d.median)}`);
        if (d.sigma !== undefined) parts.push(`sigma ${num(d.sigma)}`);
    } else if (d.shape === 'zipf' && d.exponent !== undefined) {
        parts.push(num(d.exponent));
    }
    return parts.join(' ');
}

export function distributionLine(d: Rec): string {
    return `${d.field} ${distributionShape(d)}${describe(d.description as string | undefined)}`;
}

export function printOptions(w: IndentWriter, o: Rec): void {
    w.block('options', () => {
        if (o.alpha !== undefined) w.line(`alpha ${num(o.alpha)}`);
        if (o.decimals !== undefined) w.line(`decimals ${num(o.decimals)}`);
        if (o.nullRate !== undefined) w.line(`null-rate ${pct(o.nullRate)}`);
        if (o.defaultDwell !== undefined) w.line(`default-dwell ${durationToken(o.defaultDwell)}`);
        const dwell = o.dwell as Record<string, string> | undefined;
        if (dwell && Object.keys(dwell).length) {
            w.block('dwell', () => {
                for (const [k, v] of Object.entries(dwell)) {
                    const [from, to] = k.split('->');
                    w.line(`${from} --> ${to} : ${durationToken(v)}`);
                }
            });
        }
        if (o.reactionLatency !== undefined) w.line(`reaction-latency ${durationToken(o.reactionLatency)}`);
        if (o.rejections !== undefined) w.line(`rejections ${num(o.rejections)}`);
    });
}
