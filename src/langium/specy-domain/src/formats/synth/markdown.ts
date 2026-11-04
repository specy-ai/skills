/**
 * The Markdown encoding of a synthetic-data scenario — writer and reader.
 *
 * Writer (document -> Markdown): the canonical document of
 * src/metamodels/MODEL-FORMATS.md, "Synthetic-data scenario". A front matter
 * names the language and the `.domain` the scenario is written against;
 * `# scenario Name` carries the description and the header clauses as
 * `**Label:**` lines; the six blocks of the DSL are `##` group headings:
 * Populations (a table), Outcomes (one `###` heading per outcome, its clauses as
 * labels, its figures as a table), Givens (one `###` heading per entity, the
 * file as labels or the rows as a table), Vocabulary, Distributions (a table)
 * and Options (labels, the dwell block as a list).
 *
 * Reader (Markdown -> DSL): tolerant of the spellings an author or a language
 * model uses — labels as a `- Label: value` list, alias columns, figures as a
 * `- key: value` list, an outcome's path in its heading, a `specy` island
 * pasted under a group heading — it transpiles what it recognizes to DSL and
 * reports the rest as unmapped, line by line. The scenario's domain comes from
 * the front matter (`domain:`) or a `**Domain:**` line: without it the
 * references cannot resolve, so its absence is an error.
 */
import type { ScenarioJson } from '../../cli/synth-model.js';
import type { Block, ListItem } from '../kit/markdown-blocks.js';
import { quote } from '../kit/dsl.js';
import { MarkdownWriter, code } from '../kit/markdown-writer.js';
import {
    DslBuilder,
    cell,
    columnOf,
    describeBlock,
    groupKind,
    matchHeading,
    normalizeWord,
    parseFrontMatter,
    parseItemLabel,
    parseLabels,
    rowRecord,
    sectionsOf,
    splitDash,
    splitList,
    stripInline,
    unquoteCode,
    type KindSpec,
    type MarkdownReadResult,
    type Section,
} from '../kit/markdown-reader.js';
import { dateToken, distributionShape, durationToken, instantToken, num, pct, rowLiteral } from './printer.js';

type Rec = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Kinds — one table drives the writer's headings and the reader's matching
// ---------------------------------------------------------------------------

export const SCENARIO_KIND: KindSpec[] = [{ kind: 'scenario', words: ['synth scenario', 'synthetic data scenario', 'synthetic-data scenario'] }];

/** The six blocks of a scenario, as group headings. */
export const BLOCK_KINDS: KindSpec[] = [
    { kind: 'populations', group: ['populations', 'population', 'rows', 'row counts', 'volumes', 'how many rows'] },
    { kind: 'outcomes', group: ['outcomes', 'outcome', 'facts', 'figures', 'targets', 'what the data adds up to'] },
    { kind: 'givens', group: ['givens', 'given', 'reference data', 'master data', 'supplied data', 'catalogues'] },
    { kind: 'vocabulary', group: ['vocabulary', 'vocab', 'words', 'word lists', 'text'] },
    { kind: 'distributions', group: ['distributions', 'distribution', 'shapes', 'spreads'] },
    { kind: 'options', group: ['options', 'option', 'settings', 'knobs', 'generator options'] },
];

export const OUTCOME_KINDS: KindSpec[] = [
    { kind: 'curve', words: ['revenue curve', 'time series'] },
    { kind: 'total', words: ['sum'] },
    { kind: 'share', words: ['split', 'breakdown'] },
    { kind: 'mix', words: ['lifecycle mix', 'state mix'] },
    { kind: 'rate', words: ['proportion'] },
    { kind: 'rollup', words: ['roll-up', 'roll up'] },
];

export const GIVEN_KIND: KindSpec[] = [{ kind: 'given', words: ['rows of', 'reference'] }];

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

export function scenarioToMarkdown(doc: ScenarioJson): string {
    const d = doc as ScenarioJson & Rec;
    const w = new MarkdownWriter();
    w.frontMatter({ specy: 'synth', domain: d.domain, requirements: d.requirementsSource });
    w.heading(1, `scenario ${d.name}`);
    w.para(d.description);
    w.labelInline('Satisfies', d.satisfies as string[] | undefined);
    if (d.seed !== undefined) w.label('Seed', typeof d.seed === 'number' ? num(d.seed) : code(String(d.seed)));
    if (d.horizon) w.label('Horizon', `${d.horizon.from} .. ${d.horizon.to}`);
    w.label('As of', d.asOf);

    w.heading(2, 'Populations');
    writePopulations(w, (d.populations as Rec[]) ?? []);

    if (d.outcomes?.length) {
        w.heading(2, 'Outcomes');
        for (const o of d.outcomes as Rec[]) writeOutcome(w, o);
    }
    if (d.givens?.length) {
        w.heading(2, 'Givens');
        for (const g of d.givens as Rec[]) writeGiven(w, g);
    }
    if (d.vocabulary) {
        w.heading(2, 'Vocabulary');
        writeVocabulary(w, d.vocabulary as Rec);
    }
    if (d.distributions?.length) {
        w.heading(2, 'Distributions');
        w.table(
            ['field', 'shape', 'median', 'sigma', 'exponent', 'description'],
            (d.distributions as Rec[]).map(x => [code(String(x.field)), String(x.shape), optNum(x.median), optNum(x.sigma), optNum(x.exponent), (x.description as string) ?? '']),
        );
    }
    if (d.options && Object.keys(d.options).length) {
        w.heading(2, 'Options');
        writeOptions(w, d.options as Rec);
    }
    return w.toString();
}

function optNum(v: unknown): string {
    return v === undefined ? '' : num(v);
}

function writePopulations(w: MarkdownWriter, populations: Rec[]): void {
    w.table(
        ['entity', 'count', 'per', 'range', 'since', 'clock', 'description'],
        populations.map(p => [
            String(p.entity),
            p.count !== undefined ? num(p.count) : '',
            p.per !== undefined ? String(p.per) : '',
            p.per === undefined ? '' : p.exactly !== undefined ? `exactly ${num(p.exactly)}` : `${num(p.min ?? 1)}..${p.max === undefined ? 'n' : num(p.max)}`,
            p.since !== undefined ? String(p.since) : '',
            p.clock !== undefined ? String(p.clock) : '',
            (p.description as string) ?? '',
        ]),
    );
}

function writeOutcome(w: MarkdownWriter, o: Rec): void {
    w.heading(3, `${o.kind}${o.name ? ` ${o.name}` : ''}`);
    w.para(o.description as string | undefined);
    w.labelInline('Satisfies', o.satisfies as string[] | undefined);
    const values = (o.values ?? {}) as Record<string, unknown>;
    switch (o.kind) {
        case 'curve': {
            w.label('Measure', code(String(o.measure)));
            w.label('By', code(String(o.by)));
            w.label('Period', String(o.period));
            if (o.alpha !== undefined) w.label('Alpha', num(o.alpha));
            const counts = o.counts as Record<string, unknown> | undefined;
            const header = counts ? ['period', 'value', 'rows'] : ['period', 'value'];
            w.table(
                header,
                Object.entries(values).map(([k, v]) => (counts ? [k, num(v), counts[k] !== undefined ? num(counts[k]) : ''] : [k, num(v)])),
            );
            return;
        }
        case 'total':
            w.label('Measure', code(String(o.measure)));
            w.label('Value', num(o.value));
            if (o.alpha !== undefined) w.label('Alpha', num(o.alpha));
            return;
        case 'share': {
            w.label('Dimension', code(String(o.dimension)));
            if (o.given !== undefined) {
                w.label('Given', code(String(o.given)));
                const rows: string[][] = [];
                for (const [g, inner] of Object.entries(values)) {
                    for (const [m, f] of Object.entries((inner ?? {}) as Record<string, unknown>)) rows.push([g, m, pct(f)]);
                }
                w.table(['given', 'member', 'share'], rows);
            } else {
                w.table(['member', 'share'], Object.entries(values).map(([m, f]) => [m, pct(f)]));
            }
            return;
        }
        case 'mix':
            w.label('Machine', code(String(o.machine)));
            w.table(['state', 'share'], Object.entries(values).map(([s, f]) => [s, pct(f)]));
            return;
        case 'rate':
            w.label('Predicate', code(String(o.predicate)));
            if (o.values !== null && typeof o.values === 'object') {
                w.label('By', code(String(o.by)));
                w.label('Period', String(o.period));
                w.table(['period', 'value'], Object.entries(values).map(([k, f]) => [k, pct(f)]));
            } else {
                w.label('Value', pct(o.values));
            }
            return;
        case 'rollup':
            w.label('Total', code(String(o.total)));
            w.label('Parts', code(String(o.parts)));
            return;
        default:
            w.comment(`outcome kind "${o.kind}" has no Markdown shape`);
    }
}

function writeGiven(w: MarkdownWriter, g: Rec): void {
    w.heading(3, `given ${g.entity}`);
    w.para(g.description as string | undefined);
    if (g.csv !== undefined) w.label('Csv', code(String(g.csv)));
    if (g.json !== undefined) w.label('Json', code(String(g.json)));
    const columns = g.columns as Record<string, string> | undefined;
    if (columns && Object.keys(columns).length) {
        w.labelList(
            'Columns',
            Object.entries(columns).map(([path, src]) => `${code(path)} from ${code(src)}`),
        );
    }
    if (Array.isArray(g.rows)) {
        const rows = g.rows as Rec[];
        const keys: string[] = [];
        for (const r of rows) for (const k of Object.keys(r)) if (!keys.includes(k)) keys.push(k);
        if (keys.length) {
            w.table(
                keys,
                rows.map(r => keys.map(k => rowCell(r[k], k in r))),
            );
        } else {
            w.label('Rows', 'none');
        }
    }
}

/**
 * A row value in a table cell: scalars as text, except what the reader would
 * mistake for another type, which goes through JSON; nested values as JSON.
 */
export function rowCell(v: unknown, present: boolean): string {
    if (!present || v === undefined) return '';
    if (v === null) return 'null';
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (typeof v === 'string') {
        const ambiguous = v === '' || /^-?\d+(\.\d+)?$/.test(v) || /^(true|false|null)$/.test(v) || /^["[{]/.test(v) || v !== v.trim();
        return ambiguous ? JSON.stringify(v) : v;
    }
    return JSON.stringify(v);
}

/** The inverse of rowCell. */
export function parseRowCell(text: string): { present: boolean; value?: unknown } {
    const t = text.trim();
    if (t === '') return { present: false };
    if (t === 'null') return { present: true, value: null };
    if (t === 'true' || t === 'false') return { present: true, value: t === 'true' };
    if (/^-?\d+(\.\d+)?$/.test(t)) return { present: true, value: Number(t) };
    if (/^["[{]/.test(t)) {
        try {
            return { present: true, value: JSON.parse(t) };
        } catch {
            return { present: true, value: t };
        }
    }
    return { present: true, value: unquoteCode(t) };
}

function writeVocabulary(w: MarkdownWriter, v: Rec): void {
    w.label('Locale', v.locale as string | undefined);
    w.label('Pack', v.pack !== undefined ? code(String(v.pack)) : undefined);
    const words = (v.words as Rec[]) ?? [];
    if (words.length) {
        w.labelList(
            'Words',
            words.map(x => {
                const values = x.file !== undefined ? `file ${code(String(x.file))}` : ((x.values as string[]) ?? []).map(s => JSON.stringify(s)).join(', ');
                return `${code(String(x.field))}: ${values}${x.description ? ` — ${x.description}` : ''}`;
            }),
        );
    }
    const bindings = (v.bindings as Rec[]) ?? [];
    if (bindings.length) {
        w.labelList(
            'Bindings',
            bindings.map(b => `${code(String(b.target))} as ${b.kind}${b.description ? ` — ${b.description}` : ''}`),
        );
    }
}

function writeOptions(w: MarkdownWriter, o: Rec): void {
    if (o.alpha !== undefined) w.label('Alpha', num(o.alpha));
    if (o.decimals !== undefined) w.label('Decimals', num(o.decimals));
    if (o.nullRate !== undefined) w.label('Null rate', pct(o.nullRate));
    if (o.defaultDwell !== undefined) w.label('Default dwell', String(o.defaultDwell));
    if (o.reactionLatency !== undefined) w.label('Reaction latency', String(o.reactionLatency));
    if (o.rejections !== undefined) w.label('Rejections', num(o.rejections));
    const dwell = o.dwell as Record<string, string> | undefined;
    if (dwell && Object.keys(dwell).length) {
        w.labelList(
            'Dwell',
            Object.entries(dwell).map(([k, v]) => {
                const [from, to] = k.split('->');
                return `${from} --> ${to}: ${v}`;
            }),
        );
    }
}

// ---------------------------------------------------------------------------
// Reader
// ---------------------------------------------------------------------------

interface Label {
    label: string;
    value: string;
    line: number;
    list?: ListItem[];
}

interface Parts {
    description?: string;
    descriptionLine?: number;
    labels: Label[];
    tables: { header: string[]; rows: string[][]; line: number }[];
    lists: { items: ListItem[]; line: number }[];
    islands: { text: string; line: number; lang: string }[];
    unmapped: Block[];
}

/** `- Label: value`, or `- Label:` whose value is the nested list that follows (`- Dwell:` + its transitions). */
function itemLabel(i: ListItem): { label: string; value: string } | undefined {
    const l = parseItemLabel(i.text);
    if (l) return l;
    if (!i.children.length) return undefined;
    const m = /^([A-Za-z][A-Za-z0-9 _-]{0,40}?)\s*:?\s*$/.exec(stripInline(i.text));
    return m ? { label: normalizeWord(m[1]), value: '' } : undefined;
}

/** Every `Label: value` list item is a label (the header clauses, a given, the options). */
const ANY_LABEL = (): boolean => true;

/** The labels an outcome may carry as list items; other items are data points. */
const OUTCOME_LABELS = new Set(
    ['measure', 'sum', 'sum of', 'of', 'by', 'over', 'date', 'clock', 'along', 'period', 'per', 'granularity', 'bucket', 'alpha', 'machine', 'state machine', 'lifecycle', 'states of', 'dimension', 'field', 'column', 'split', 'given', 'grouped by', 'predicate', 'condition', 'where', 'rows where', 'value', 'rate', 'fraction', 'share', 'proportion', 'total', 'equals', 'sum equals', 'parent', 'whole', 'parts', 'from', 'children', 'lines', 'satisfies', 'requirements', 'traces', 'description'].map(normalizeWord),
);
const OUTCOME_LABEL = (label: string): boolean => OUTCOME_LABELS.has(label);
const NO_LABEL = (): boolean => false;

/**
 * Sort a section's own blocks into slots. `isLabel` says which `Label: value`
 * list items are labels; the other items are data (`- delivered: 72%`).
 */
function collect(blocks: Block[], isLabel: (label: string) => boolean): Parts {
    const parts: Parts = { labels: [], tables: [], lists: [], islands: [], unmapped: [] };
    let pending: Label | undefined;
    for (const b of blocks) {
        switch (b.type) {
            case 'paragraph': {
                const labels = parseLabels(b.text);
                if (labels) {
                    for (const l of labels) parts.labels.push({ ...l, line: b.line });
                    pending = labels[labels.length - 1].value === '' ? parts.labels[parts.labels.length - 1] : undefined;
                } else if (parts.description === undefined && !parts.labels.length && !parts.tables.length && !parts.lists.length) {
                    parts.description = stripInline(b.text);
                    parts.descriptionLine = b.line;
                    pending = undefined;
                } else {
                    parts.unmapped.push(b);
                    pending = undefined;
                }
                break;
            }
            case 'list': {
                if (pending) {
                    pending.list = b.items;
                    pending = undefined;
                    break;
                }
                const data: ListItem[] = [];
                for (const i of b.items) {
                    const l = itemLabel(i);
                    if (l && isLabel(l.label)) parts.labels.push({ label: l.label, value: l.value, line: i.line, list: i.children.length ? i.children : undefined });
                    else data.push(i);
                }
                if (data.length) parts.lists.push({ items: data, line: data[0].line });
                break;
            }
            case 'table':
                parts.tables.push({ header: b.header, rows: b.rows, line: b.line });
                pending = undefined;
                break;
            case 'code':
                parts.islands.push({ text: b.text, line: b.line, lang: b.lang });
                pending = undefined;
                break;
            case 'quote':
                if (parts.description === undefined) {
                    parts.description = b.text;
                    parts.descriptionLine = b.line;
                } else parts.unmapped.push(b);
                pending = undefined;
                break;
            default:
                break;
        }
    }
    return parts;
}

const FRACTION = /^-?\d+(\.\d+)?\s*%?$/;

function fractionToken(v: string): string | undefined {
    const t = unquoteCode(stripInline(v)).replace(/\s+/g, '');
    return FRACTION.test(t) ? t : undefined;
}

function numberToken(v: string): string | undefined {
    const t = unquoteCode(stripInline(v)).replace(/[\s,_]/g, '');
    return /^-?\d+(\.\d+)?$/.test(t) ? t : undefined;
}

function pathToken(v: string): string {
    return unquoteCode(stripInline(v)).trim();
}

class SynthReader {
    readonly b = new DslBuilder('    ');

    constructor(private readonly header: Record<string, string>) {}

    read(root: Section): void {
        const preamble = collect(root.blocks, ANY_LABEL);
        // Blocks before the first heading may hold the header clauses (a document without a `# scenario` line).
        let scenario = root.children.find(c => matchHeading(c.heading!.text, SCENARIO_KIND) && !matchHeading(c.heading!.text, SCENARIO_KIND)!.defaulted);
        let name: string | undefined;
        if (scenario) {
            name = matchHeading(scenario.heading!.text, SCENARIO_KIND)!.rest;
        } else if (root.children.length === 1 && !groupKind(root.children[0].heading!.text, BLOCK_KINDS)) {
            scenario = root.children[0];
            name = stripInline(scenario.heading!.text)
                .split(/[^A-Za-z0-9_]+/)
                .filter(Boolean)
                .map(w => w[0].toUpperCase() + w.slice(1))
                .join('');
            this.b.warn(scenario.heading!.line, `"${scenario.heading!.text}" read as the scenario heading (write "# scenario ${name}")`, 'MD-DEFAULT-KIND');
        } else {
            // The groups sit directly under the root: the scenario is the document itself.
            scenario = root;
        }
        name = (name ?? this.header.name ?? this.header.scenario ?? '').split(/\s+/)[0];
        if (!name) {
            this.b.error(scenario.heading?.line ?? 1, 'no scenario name: write "# scenario Name" or name: in the front matter', 'MD-SCENARIO-NAME');
            name = 'Scenario';
        }
        const parts = scenario === root ? preamble : collect(scenario.blocks, ANY_LABEL);
        if (scenario !== root) this.reportUnmapped(preamble, 'before the scenario heading');
        this.emitScenario(scenario, name, parts);
    }

    private reportUnmapped(parts: Parts, where: string): void {
        for (const u of parts.unmapped) this.b.unmapped(u, describeBlock(u), where);
        for (const l of parts.labels) this.b.unmapped({ line: l.line }, `label "${l.label}"`, where);
        for (const t of parts.tables) this.b.unmapped({ line: t.line }, `table with columns ${t.header.join(', ')}`, where);
        for (const l of parts.lists) this.b.unmapped({ line: l.line }, `list: ${l.items.map(i => i.text).join(' / ')}`, where);
        for (const i of parts.islands) this.b.unmapped({ line: i.line }, 'code block', where);
        if (parts.description !== undefined) this.b.unmapped({ line: parts.descriptionLine ?? 1 }, parts.description, where);
    }

    private take(parts: Parts, ...labels: string[]): Label | undefined {
        const i = parts.labels.findIndex(l => labels.includes(l.label));
        return i === -1 ? undefined : parts.labels.splice(i, 1)[0];
    }

    private satisfies(parts: Parts): string[] {
        const s = this.take(parts, 'satisfies', 'requirements', 'traces');
        return s ? (s.list ? s.list.map(i => unquoteCode(stripInline(i.text))) : splitList(s.value)) : [];
    }

    private satisfiesLine(parts: Parts, line: number): void {
        const ids = this.satisfies(parts);
        if (ids.length) this.b.line(`satisfies [${ids.join(', ')}]`, line);
    }

    /** Islands under a group are complete declarations: pasted verbatim inside the block. */
    private islands(parts: Parts): void {
        for (const i of parts.islands.splice(0, parts.islands.length)) {
            if (i.lang && !/^(specy|synth|dsl|text)$/i.test(i.lang)) {
                this.b.unmapped({ line: i.line }, `code block (${i.lang})`, 'only specy islands are read');
                continue;
            }
            this.b.raw(i.text, i.line + 1);
        }
    }

    // -----------------------------------------------------------------------
    // Scenario
    // -----------------------------------------------------------------------

    private emitScenario(section: Section, name: string, parts: Parts): void {
        const line = section.heading?.line ?? 1;
        const description = parts.description;
        parts.description = undefined;
        this.b.open(`scenario ${name}${description ? ` :: ${quote(description)}` : ''}`, line);
        this.satisfiesLine(parts, line);

        const domainLabel = this.take(parts, 'domain', 'domain source', 'domain model', 'model', 'against');
        const domain = this.header.domain ?? this.header['domain-source'] ?? this.header.model ?? (domainLabel ? pathToken(domainLabel.value) : undefined);
        if (domain) this.b.line(`domain-source ${quote(domain)}`, domainLabel?.line ?? line);
        else this.b.error(line, 'the scenario names no .domain: add "domain: <file>.domain" to the front matter or a **Domain:** line', 'MD-DOMAIN');

        const reqLabel = this.take(parts, 'requirements source', 'sysreq', 'requirements file');
        const req = this.header.requirements ?? this.header['requirements-source'] ?? (reqLabel ? pathToken(reqLabel.value) : undefined);
        if (req) this.b.line(`requirements-source ${quote(req)}`, reqLabel?.line ?? line);

        const seed = this.take(parts, 'seed');
        const seedText = seed ? pathToken(seed.value) : this.header.seed;
        if (seedText !== undefined && seedText !== '') this.b.line(`seed ${/^-?\d+(\.\d+)?$/.test(seedText) ? seedText : quote(seedText)}`, seed?.line ?? line);

        const horizon = this.take(parts, 'horizon', 'period', 'window', 'time window', 'dates');
        const horizonText = horizon ? pathToken(horizon.value) : this.header.horizon;
        if (horizonText) {
            const m = /^(\S+?)\s*(?:\.\.|→|->|to|–|—)\s*(\S+)$/.exec(horizonText);
            if (m) this.b.line(`horizon ${dateToken(m[1].replace(/^"|"$/g, ''))} .. ${dateToken(m[2].replace(/^"|"$/g, ''))}`, horizon?.line ?? line);
            else this.b.unmapped({ line: horizon?.line ?? line }, `horizon "${horizonText}"`, 'expected "from .. to"');
        }

        const asOf = this.take(parts, 'as of', 'as-of', 'observed at', 'observation instant', 'snapshot');
        const asOfText = asOf ? pathToken(asOf.value) : this.header['as-of'] ?? this.header.asOf;
        if (asOfText) this.b.line(`as-of ${instantToken(asOfText.replace(/^"|"$/g, ''))}`, asOf?.line ?? line);

        // The six blocks, from the group headings (any order in the document, the grammar's order here).
        const groups = new Map<string, Section[]>();
        for (const child of section.children) {
            const gk = groupKind(child.heading!.text, BLOCK_KINDS);
            if (gk) {
                groups.set(gk, [...(groups.get(gk) ?? []), child]);
                continue;
            }
            // An outcome or a given written directly under the scenario heading.
            if (matchHeading(child.heading!.text, OUTCOME_KINDS) && !matchHeading(child.heading!.text, OUTCOME_KINDS)!.defaulted) {
                groups.set('outcomes', [...(groups.get('outcomes') ?? []), { blocks: [], children: [child], heading: child.heading }]);
                continue;
            }
            this.b.warn(child.heading!.line, `heading "${child.heading!.text}" names no part of a scenario (Populations, Outcomes, Givens, Vocabulary, Distributions, Options); its sub-headings are read in place`, 'MD-HEADING');
            this.reportUnmapped(collect(child.blocks, ANY_LABEL), `under the heading "${child.heading!.text}"`);
            for (const sub of child.children) {
                const gk2 = groupKind(sub.heading!.text, BLOCK_KINDS);
                if (gk2) groups.set(gk2, [...(groups.get(gk2) ?? []), sub]);
                else {
                    this.b.warn(sub.heading!.line, `heading "${sub.heading!.text}" names no part of a scenario`, 'MD-HEADING');
                    this.reportUnmapped(collect(sub.blocks, ANY_LABEL), `under the heading "${sub.heading!.text}"`);
                }
            }
        }

        // Populations may also be a table or a list right under the scenario heading.
        const popTable = parts.tables.findIndex(t => columnOf(t, 'entity', 'name', 'row source', 'table') !== -1);
        const inline: Section = { blocks: [], children: [] };
        if (popTable !== -1) inline.blocks.push({ type: 'table', line: parts.tables[popTable].line, endLine: parts.tables[popTable].line, header: parts.tables[popTable].header, rows: parts.tables[popTable].rows });
        if (popTable !== -1) parts.tables.splice(popTable, 1);
        const popSections = [...(groups.get('populations') ?? []), ...(inline.blocks.length ? [inline] : [])];

        this.b.blank();
        this.emitPopulations(popSections, line);
        if (groups.has('outcomes')) this.emitOutcomes(groups.get('outcomes')!);
        if (groups.has('givens')) this.emitGivens(groups.get('givens')!);
        if (groups.has('vocabulary')) this.emitVocabulary(groups.get('vocabulary')!);
        if (groups.has('distributions')) this.emitDistributions(groups.get('distributions')!);
        if (groups.has('options')) this.emitOptions(groups.get('options')!);

        this.reportUnmapped(parts, `in scenario ${name}`);
        this.b.close(line);
    }

    // -----------------------------------------------------------------------
    // Populations
    // -----------------------------------------------------------------------

    private emitPopulations(sections: Section[], scenarioLine: number): void {
        const line = sections[0]?.heading?.line ?? scenarioLine;
        if (!sections.length) this.b.error(scenarioLine, 'a scenario needs a "## Populations" section (a table with entity and count/per columns)', 'MD-POPULATIONS');
        this.b.open('populations', line);
        for (const s of sections) {
            const parts = collect([...s.blocks, ...s.children.flatMap(c => c.blocks)], NO_LABEL);
            for (const c of s.children) if (c.blocks.length === 0) this.b.warn(c.heading!.line, `heading "${c.heading!.text}" under Populations is ignored`, 'MD-HEADING');
            this.populationsTables(parts);
            this.populationsLists(parts);
            this.islands(parts);
            parts.description = undefined;
            this.reportUnmapped(parts, 'in Populations');
        }
        this.b.close(line);
    }

    private populationsTables(parts: Parts): void {
        for (let i = parts.tables.length - 1; i >= 0; i--) {
            const t = parts.tables[i];
            if (columnOf(t, 'entity', 'name', 'row source', 'table') === -1) continue;
            parts.tables.splice(i, 1);
            t.rows.forEach((row, n) => {
                const rec = rowRecord(t, row);
                const entity = cell(rec, 'entity', 'name', 'row source', 'table');
                if (!entity) return;
                const per = cell(rec, 'per', 'parent', 'of');
                const count = cell(rec, 'count', 'rows', 'number', 'n', 'size', 'how many');
                const range = cell(rec, 'range', 'per parent', 'cardinality', 'min..max');
                const exactly = cell(rec, 'exactly');
                const min = cell(rec, 'min');
                const max = cell(rec, 'max');
                const since = cell(rec, 'since', 'from');
                const clock = cell(rec, 'clock', 'date field', 'time field');
                const desc = stripInline(cell(rec, 'description', 'meaning', 'notes', 'comment'));
                const at = t.line + 2 + n;
                this.b.line(this.populationLine(entity, { per, count, range, exactly, min, max, since, clock, desc }, at), at);
            });
        }
    }

    private populationLine(entity: string, p: { per: string; count: string; range: string; exactly: string; min: string; max: string; since: string; clock: string; desc: string }, at: number): string {
        const out = [entity];
        if (p.per) {
            out.push(`per ${p.per}`);
            // `exactly 1` or `1..5` may sit in the range, exactly, min or count cell; min/max may be two columns
            const cells = [p.range, p.exactly, p.min, p.count].map(c => c.replace(/\s+/g, ''));
            const range = cells.map(c => /^(\d+)\.\.(\d+|[nN*])$/.exec(c)).find(Boolean);
            const explicit = cells.some(c => /^exactly\d+$/i.test(c)) || p.exactly.trim() !== '';
            const exactly = cells.map(c => /^(?:exactly)?(\d+)$/i.exec(c)?.[1]).find(Boolean);
            if (range) out.push(`${range[1]}..${range[2].replace('*', 'n')}`);
            else if (p.max.trim()) out.push(`${/^\d+$/.test(p.min.trim()) ? p.min.trim() : '1'}..${p.max.trim()}`);
            else if (exactly && (explicit || !p.min.trim())) out.push(`exactly ${exactly}`);
            else if (/^\d+$/.test(p.min.trim())) out.push(`${p.min.trim()}..n`);
            else {
                out.push('1..n');
                this.b.warn(at, `population ${entity} per ${p.per} states no range; assuming 1..n`, 'MD-POPULATION-RANGE');
            }
        } else {
            const n = numberToken(p.count);
            if (n) out.push(`count ${n}`);
            else {
                out.push('count 0');
                this.b.error(at, `population ${entity} needs a count (a number) or a parent (per)`, 'MD-POPULATION-COUNT');
            }
            if (p.since) out.push(`since ${dateToken(p.since.replace(/^"|"$/g, ''))}`);
        }
        if (p.clock) out.push(`clock ${p.clock}`);
        return out.join(' ') + (p.desc ? ` :: ${quote(p.desc)}` : '');
    }

    /** `- Customer: 200`, `- OrderLine: 1..5 per Order`, `- Payment: exactly 1 per Order`, `- Customer: 300 since 2023-01-01 — description`. */
    private populationsLists(parts: Parts): void {
        for (const list of parts.lists.splice(0, parts.lists.length)) {
            for (const item of list.items) {
                const { head, tail } = splitDash(item.text);
                const text = unquoteCode(stripInline(head));
                const m = /^([A-Z][A-Za-z0-9]*)\s*[:：]\s*(.+)$/.exec(text) ?? /^([A-Z][A-Za-z0-9]*)\s+(.+)$/.exec(text);
                if (!m) {
                    this.b.unmapped({ line: item.line }, `population "${item.text}"`, 'expected "Entity: count" or "Entity: a..b per Parent"');
                    continue;
                }
                let rest = ` ${m[2]} `;
                const grab = (re: RegExp): string => {
                    const x = re.exec(rest);
                    if (!x) return '';
                    rest = rest.replace(x[0], ' ');
                    return x[1];
                };
                const per = grab(/\sper\s+([A-Z][A-Za-z0-9]*)\s/);
                const exactly = grab(/\sexactly\s+(\d+)\s/);
                const range = grab(/\s(\d+\.\.(?:\d+|[nN*]))\s/);
                const since = grab(/\ssince\s+(\S+)\s/);
                const clock = grab(/\sclock\s+(\S+)\s/);
                const count = grab(/\scount\s+(\d+)\s/) || grab(/\s(\d+)\s/);
                const leftover = rest.trim();
                if (leftover) this.b.warn(item.line, `population ${m[1]}: "${leftover}" not understood`, 'MD-POPULATION');
                this.b.line(this.populationLine(m[1], { per, count: per && !exactly && !range ? '' : count, range, exactly: per && !range && !exactly ? count : exactly, min: '', max: '', since, clock, desc: tail ? stripInline(tail) : '' }, item.line), item.line);
            }
        }
    }

    // -----------------------------------------------------------------------
    // Outcomes
    // -----------------------------------------------------------------------

    private emitOutcomes(sections: Section[]): void {
        const line = sections[0].heading?.line ?? 1;
        this.b.blank();
        this.b.open('outcomes', line);
        for (const s of sections) {
            const parts = collect(s.blocks, NO_LABEL);
            this.islands(parts);
            parts.description = undefined;
            this.reportUnmapped(parts, 'in Outcomes');
            for (const child of s.children) {
                const m = matchHeading(child.heading!.text, OUTCOME_KINDS);
                if (!m) {
                    this.b.warn(child.heading!.line, `heading "${child.heading!.text}" is not an outcome (curve, total, share, mix, rate, rollup)`, 'MD-HEADING');
                    this.reportUnmapped(collect(child.blocks, NO_LABEL), `under the heading "${child.heading!.text}"`);
                    continue;
                }
                this.emitOutcome(child, m.kind, m.rest);
            }
        }
        this.b.close(line);
    }

    private emitOutcome(section: Section, kind: string, rest: string): void {
        const line = section.heading!.line;
        const blocks = [...section.blocks, ...section.children.flatMap(c => c.blocks)];
        const parts = collect(blocks, OUTCOME_LABEL);
        // The heading may carry the name (an identifier) and/or the path (a dotted name).
        let name = '';
        let headPath = '';
        for (const tok of unquoteCode(rest).split(/\s+/).filter(Boolean)) {
            if (tok.includes('.') && !headPath) headPath = tok;
            else if (/^[a-z][A-Za-z0-9_]*$/.test(tok) && !name) name = tok;
            else if (/^[A-Z][A-Za-z0-9]*$/.test(tok) && !headPath) headPath = tok;
        }
        const desc = parts.description ? ` :: ${quote(parts.description)}` : '';
        parts.description = undefined;
        const nm = name ? ` ${name}` : '';
        const path = (...labels: string[]): string => {
            const l = this.take(parts, ...labels);
            return l ? pathToken(l.value) : '';
        };
        const need = (value: string, what: string): string => {
            if (!value) this.b.error(line, `${kind}${nm}: missing **${what}:**`, 'MD-OUTCOME');
            return value || 'Missing';
        };
        switch (kind) {
            case 'curve': {
                const measure = need(path('measure', 'sum', 'sum of', 'of') || headPath, 'Measure');
                const by = need(path('by', 'over', 'date', 'clock', 'along'), 'By');
                const period = need(path('period', 'per', 'granularity', 'bucket').toLowerCase(), 'Period');
                const a = path('alpha');
                this.b.open(`curve${nm} ${measure} by ${by} per ${period}${a ? ` alpha ${a}` : ''}${desc}`, line);
                this.satisfiesLine(parts, line);
                for (const [k, v, rows] of this.points(parts, line, 'number')) this.b.line(`${k}: ${v}${rows ? ` over ${rows} rows` : ''}`, line);
                this.b.close(line);
                break;
            }
            case 'total': {
                const measure = need(path('measure', 'sum', 'sum of', 'of') || headPath, 'Measure');
                const value = need(numberToken(path('value', 'total', 'equals', 'sum equals', '=')) ?? '', 'Value');
                const a = path('alpha');
                const ids = this.satisfies(parts);
                this.b.line(`total${nm} ${measure} = ${value}${a ? ` alpha ${a}` : ''}${desc}${ids.length ? ` satisfies [${ids.join(', ')}]` : ''}`, line);
                break;
            }
            case 'share': {
                const dimension = need(path('dimension', 'field', 'column', 'of', 'split') || headPath, 'Dimension');
                const given = path('given', 'per', 'by', 'grouped by');
                this.b.open(`share${nm} ${dimension}${given ? ` given ${given}` : ''}${desc}`, line);
                this.satisfiesLine(parts, line);
                if (given) {
                    const groups = new Map<string, string[]>();
                    for (const [g, m, f] of this.groupedPoints(parts, line)) groups.set(g, [...(groups.get(g) ?? []), `${m}: ${f}`]);
                    for (const [g, entries] of groups) this.b.line(`${g}: { ${entries.join(', ')} }`, line);
                } else {
                    for (const [k, v] of this.points(parts, line, 'fraction')) this.b.line(`${k}: ${v}`, line);
                }
                this.b.close(line);
                break;
            }
            case 'mix': {
                const machine = need(path('machine', 'state machine', 'lifecycle', 'of', 'states of') || headPath, 'Machine');
                this.b.open(`mix${nm} ${machine}${desc}`, line);
                this.satisfiesLine(parts, line);
                for (const [k, v] of this.points(parts, line, 'fraction')) this.b.line(`${k}: ${v}`, line);
                this.b.close(line);
                break;
            }
            case 'rate': {
                const predicate = need(path('predicate', 'condition', 'where', 'of', 'rows where') || headPath, 'Predicate');
                const by = path('by', 'over', 'date', 'clock');
                const value = fractionToken(path('value', 'rate', 'fraction', 'share', 'proportion'));
                if (by || (!value && (parts.tables.length || parts.lists.length))) {
                    const period = need(path('period', 'per', 'granularity').toLowerCase(), 'Period');
                    this.b.open(`rate${nm} ${predicate} by ${need(by, 'By')} per ${period}${desc}`, line);
                    this.satisfiesLine(parts, line);
                    for (const [k, v] of this.points(parts, line, 'fraction')) this.b.line(`${k}: ${v}`, line);
                    this.b.close(line);
                } else {
                    const ids = this.satisfies(parts);
                    this.b.line(`rate${nm} ${predicate} : ${need(value ?? '', 'Value')}${desc}${ids.length ? ` satisfies [${ids.join(', ')}]` : ''}`, line);
                }
                break;
            }
            case 'rollup': {
                const total = need(path('total', 'parent', 'sum', 'whole') || headPath, 'Total');
                const partsPath = need(path('parts', 'from', 'children', 'of', 'lines'), 'Parts');
                const ids = this.satisfies(parts);
                this.b.line(`rollup${nm} ${total} from ${partsPath}${desc}${ids.length ? ` satisfies [${ids.join(', ')}]` : ''}`, line);
                break;
            }
        }
        this.islands(parts);
        this.reportUnmapped(parts, `in ${kind}${nm}`);
    }

    /** The `key: value [rows]` points of an outcome, from its table or its list. */
    private points(parts: Parts, line: number, kind: 'number' | 'fraction'): [string, string, string?][] {
        const out: [string, string, string?][] = [];
        const token = (v: string): string | undefined => (kind === 'number' ? numberToken(v) : fractionToken(v));
        const table = parts.tables.shift();
        if (table) {
            const keyCol = ['period', 'key', 'month', 'date', 'state', 'member', 'value of', 'bucket', 'week', 'quarter', 'year', 'day'].map(normalizeWord);
            const valCol = ['value', 'share', 'amount', 'sum', 'fraction', 'percent', '%', 'rate', 'figure', 'revenue', 'count'].map(normalizeWord);
            const ki = table.header.findIndex(h => keyCol.includes(normalizeWord(h)));
            const vi = table.header.findIndex((h, i) => i !== ki && valCol.includes(normalizeWord(h)));
            const ri = columnOf(table, 'rows', 'over', 'n', 'row count');
            if (ki === -1 || vi === -1) {
                // Two columns: key then value.
                const [k, v] = [ki === -1 ? 0 : ki, vi === -1 ? (ki === 0 ? 1 : 0) : vi];
                if (table.header.length < 2) this.b.unmapped({ line: table.line }, `table with columns ${table.header.join(', ')}`, 'expected key and value columns');
                else this.rows(table.rows, k, v, ri, token, table.line, out);
            } else {
                this.rows(table.rows, ki, vi, ri, token, table.line, out);
            }
        }
        for (const list of parts.lists.splice(0, parts.lists.length)) {
            for (const item of list.items) {
                const m = /^(.+?)\s*[:：=]\s*(.+)$/.exec(unquoteCode(stripInline(item.text)));
                if (!m) {
                    this.b.unmapped({ line: item.line }, `point "${item.text}"`, 'expected "key: value"');
                    continue;
                }
                const key = unquoteCode(m[1]).trim();
                const rowsM = /^(.*?)\s*(?:\(?\s*over\s+(\d+)\s+rows\s*\)?)$/.exec(m[2]);
                const raw = rowsM ? rowsM[1] : m[2];
                const v = token(raw);
                if (v === undefined) this.b.unmapped({ line: item.line }, `point "${item.text}"`, `"${raw.trim()}" is not a ${kind}`);
                else out.push([key, v, rowsM?.[2]]);
            }
        }
        if (!out.length) this.b.warn(line, 'the outcome lists no values', 'MD-OUTCOME-VALUES');
        return out;
    }

    private rows(rows: string[][], ki: number, vi: number, ri: number, token: (v: string) => string | undefined, line: number, out: [string, string, string?][]): void {
        rows.forEach((row, n) => {
            const key = unquoteCode(stripInline(row[ki] ?? '')).trim();
            const v = token(row[vi] ?? '');
            if (!key) return;
            if (v === undefined) this.b.unmapped({ line: line + 2 + n }, `row "${row.join(' | ')}"`, `"${row[vi] ?? ''}" is not a number`);
            else out.push([key, v, ri !== -1 ? numberToken(row[ri] ?? '') : undefined]);
        });
    }

    /** `given | member | share` rows, or a list of groups with nested member items. */
    private groupedPoints(parts: Parts, line: number): [string, string, string][] {
        const out: [string, string, string][] = [];
        const table = parts.tables.shift();
        if (table) {
            const gi = columnOf(table, 'given', 'group', 'when', 'value of given');
            const mi = columnOf(table, 'member', 'value', 'key');
            const si = columnOf(table, 'share', 'fraction', 'percent', '%', 'rate');
            if (gi === -1 || mi === -1 || si === -1) this.b.unmapped({ line: table.line }, `table with columns ${table.header.join(', ')}`, 'expected given, member and share columns');
            else {
                table.rows.forEach((row, n) => {
                    const f = fractionToken(row[si] ?? '');
                    if (f) out.push([unquoteCode(row[gi] ?? '').trim(), unquoteCode(row[mi] ?? '').trim(), f]);
                    else this.b.unmapped({ line: table.line + 2 + n }, `row "${row.join(' | ')}"`, 'the share is not a fraction');
                });
            }
        }
        for (const list of parts.lists.splice(0, parts.lists.length)) {
            for (const item of list.items) {
                const g = unquoteCode(stripInline(item.text)).replace(/:\s*$/, '').trim();
                for (const child of item.children) {
                    const m = /^(.+?)\s*[:=]\s*(.+)$/.exec(unquoteCode(stripInline(child.text)));
                    const f = m ? fractionToken(m[2]) : undefined;
                    if (m && f) out.push([g, unquoteCode(m[1]).trim(), f]);
                    else this.b.unmapped({ line: child.line }, `point "${child.text}"`, 'expected "member: share"');
                }
                if (!item.children.length) this.b.unmapped({ line: item.line }, `group "${item.text}"`, 'expected nested "member: share" items');
            }
        }
        if (!out.length) this.b.warn(line, 'the share lists no values', 'MD-OUTCOME-VALUES');
        return out;
    }

    // -----------------------------------------------------------------------
    // Givens
    // -----------------------------------------------------------------------

    private emitGivens(sections: Section[]): void {
        const line = sections[0].heading?.line ?? 1;
        this.b.blank();
        this.b.open('givens', line);
        for (const s of sections) {
            const parts = collect(s.blocks, NO_LABEL);
            this.islands(parts);
            parts.description = undefined;
            this.reportUnmapped(parts, 'in Givens');
            for (const child of s.children) {
                const m = matchHeading(child.heading!.text, GIVEN_KIND, 'given')!;
                const entity = unquoteCode(m.rest).split(/\s+/)[0];
                if (!/^[A-Z][A-Za-z0-9]*$/.test(entity)) {
                    this.b.warn(child.heading!.line, `heading "${child.heading!.text}" is not a given (write "### given Entity" or "### Entity")`, 'MD-HEADING');
                    this.reportUnmapped(collect(child.blocks, NO_LABEL), `under the heading "${child.heading!.text}"`);
                    continue;
                }
                this.emitGiven(child, entity);
            }
        }
        this.b.close(line);
    }

    private emitGiven(section: Section, entity: string): void {
        const line = section.heading!.line;
        const parts = collect([...section.blocks, ...section.children.flatMap(c => c.blocks)], ANY_LABEL);
        const desc = parts.description ? ` :: ${quote(parts.description)}` : '';
        parts.description = undefined;
        const csv = this.take(parts, 'csv', 'csv file', 'file', 'source');
        const json = this.take(parts, 'json', 'json file');
        const columns: string[] = [];
        const col = this.take(parts, 'columns', 'column mapping', 'mapping', 'from file');
        const colItems = col ? (col.list ?? []).map(i => i.text).concat(col.value && !col.list ? [col.value] : []) : [];
        for (const item of colItems) {
            const t = stripInline(item).replace(/`/g, '');
            const m = /^(\S+)\s*(?:from|<-|←|:|=)\s*"?([^"]+?)"?\s*$/.exec(t);
            if (m) columns.push(`${m[1]} from ${quote(m[2])}`);
            else this.b.unmapped({ line: col!.line }, `column "${item}"`, 'expected "path from column"');
        }
        const body = columns.length ? () => columns.forEach(c => this.b.line(c, col!.line)) : undefined;
        const openOrLine = (text: string): void => {
            if (body) {
                this.b.open(text, line);
                body();
                this.b.close(line);
            } else this.b.line(text, line);
        };
        if (csv) {
            openOrLine(`${entity} csv ${quote(pathToken(csv.value).replace(/^"|"$/g, ''))}${desc}`);
        } else if (json) {
            openOrLine(`${entity} json ${quote(pathToken(json.value).replace(/^"|"$/g, ''))}${desc}`);
        } else {
            const table = parts.tables.shift();
            const rows: Rec[] = [];
            if (table) {
                for (const row of table.rows) {
                    const r: Rec = {};
                    table.header.forEach((h, i) => {
                        const c = parseRowCell(row[i] ?? '');
                        if (c.present) r[stripInline(h).replace(/`/g, '')] = c.value;
                    });
                    rows.push(r);
                }
            } else {
                const rowsLabel = this.take(parts, 'rows');
                if (!rowsLabel || !/^(none|0|empty|-)?$/i.test(rowsLabel.value)) {
                    this.b.error(line, `given ${entity} needs a **Csv:**/**Json:** file or a table of rows`, 'MD-GIVEN-SOURCE');
                }
            }
            if (!rows.length) openOrLine(`${entity} rows [ ]${desc}`);
            else {
                this.b.line(`${entity} rows [`, line);
                const at = table ? table.line + 2 : line;
                rows.forEach((r, i) => this.b.line(`    ${rowLiteral(r)}${i < rows.length - 1 ? ',' : ''}`, at + i));
                if (body) {
                    this.b.open(`]${desc}`, line);
                    body();
                    this.b.close(line);
                } else this.b.line(`]${desc}`, line);
            }
        }
        this.islands(parts);
        this.reportUnmapped(parts, `in given ${entity}`);
    }

    // -----------------------------------------------------------------------
    // Vocabulary, distributions, options
    // -----------------------------------------------------------------------

    private emitVocabulary(sections: Section[]): void {
        const line = sections[0].heading?.line ?? 1;
        this.b.blank();
        this.b.open('vocabulary', line);
        for (const s of sections) {
            const parts = collect([...s.blocks, ...s.children.flatMap(c => c.blocks)], NO_LABEL);
            parts.description = undefined;
            // `- Locale: fr` lists: the known labels are labels, the rest are word lists or bindings
            for (const list of parts.lists.splice(0, parts.lists.length)) {
                const rest: ListItem[] = [];
                for (const i of list.items) {
                    const l = itemLabel(i);
                    if (l && ['locale', 'language', 'lang', 'pack', 'locale pack', 'pack file', 'words', 'word lists', 'lists', 'bindings', 'kinds'].includes(l.label)) parts.labels.push({ label: l.label, value: l.value, line: i.line, list: i.children.length ? i.children : undefined });
                    else rest.push(i);
                }
                if (rest.length) parts.lists.push({ items: rest, line: rest[0].line });
            }
            const locale = this.take(parts, 'locale', 'language', 'lang');
            if (locale) {
                const v = pathToken(locale.value).replace(/^"|"$/g, '');
                this.b.line(`locale ${/^[A-Za-z_][A-Za-z0-9_]*$/.test(v) ? v : quote(v)}`, locale.line);
            }
            const pack = this.take(parts, 'pack', 'locale pack', 'pack file');
            if (pack) this.b.line(`pack ${quote(pathToken(pack.value).replace(/^"|"$/g, ''))}`, pack.line);
            const words = this.take(parts, 'words', 'word lists', 'lists');
            const wordItems = words?.list ?? [];
            const bindings = this.take(parts, 'bindings', 'kinds', 'as');
            const bindingItems = bindings?.list ?? [];
            // A bare list mixes word lists (`path: …`) and bindings (`path as kind`).
            for (const list of parts.lists.splice(0, parts.lists.length)) {
                for (const i of list.items) (/\sas\s+[a-zA-Z]/.test(stripInline(i.text)) && !/[:：]/.test(stripInline(i.text).split(/\sas\s/)[0]) ? bindingItems : wordItems).push(i);
            }
            for (const i of wordItems) this.wordList(i, words?.line ?? i.line);
            for (const i of bindingItems) {
                const { head, tail } = splitDash(i.text);
                const m = /^(\S+)\s+as\s+([A-Za-z_][\w-]*)\s*$/.exec(stripInline(head).replace(/`/g, ''));
                if (m) this.b.line(`${m[1]} as ${m[2]}${tail ? ` :: ${quote(stripInline(tail))}` : ''}`, i.line);
                else this.b.unmapped({ line: i.line }, `binding "${i.text}"`, 'expected "path as kind"');
            }
            const table = parts.tables.shift();
            if (table) {
                const fi = columnOf(table, 'field', 'path', 'target');
                const wi = columnOf(table, 'words', 'values', 'file', 'list');
                const ki = columnOf(table, 'kind', 'as');
                const di = columnOf(table, 'description', 'notes');
                table.rows.forEach((row, n) => {
                    const field = unquoteCode(row[fi] ?? '').trim();
                    const at = table.line + 2 + n;
                    const d = di !== -1 && row[di] ? ` :: ${quote(stripInline(row[di]))}` : '';
                    if (!field) return;
                    if (ki !== -1 && row[ki]?.trim()) this.b.line(`${field} as ${row[ki].trim()}${d}`, at);
                    else if (wi !== -1 && row[wi]?.trim()) this.b.line(`${field} words ${this.wordValues(row[wi])}${d}`, at);
                    else this.b.unmapped({ line: at }, `row "${row.join(' | ')}"`, 'expected words/file or kind');
                });
            }
            this.islands(parts);
            this.reportUnmapped(parts, 'in Vocabulary');
        }
        this.b.close(line);
    }

    /** `- Product.name: file "wines.txt" — description` or `- Product.name: "a", "b"`. */
    private wordList(item: ListItem, line: number): void {
        const { head, tail } = splitDash(item.text);
        const m = /^`?([A-Za-z_][\w.]*)`?\s*[:：]\s*(.+)$/.exec(stripInline(head).replace(/^`|`$/g, ''));
        if (!m) {
            this.b.unmapped({ line: item.line }, `word list "${item.text}"`, 'expected "path: values" or "path: file name"');
            return;
        }
        this.b.line(`${m[1]} words ${this.wordValues(m[2])}${tail ? ` :: ${quote(stripInline(tail))}` : ''}`, item.line || line);
    }

    private wordValues(text: string): string {
        const t = text.trim().replace(/`/g, '');
        const file = /^(?:file|from)\s+"?([^"]+?)"?\s*$/.exec(t);
        if (file) return quote(file[1]);
        if (/^"[^"]*"(\s*,\s*"[^"]*")*\s*$/.test(t)) return `[ ${t.match(/"[^"]*"/g)!.join(', ')} ]`;
        if (/\.(txt|json|csv)$/i.test(t) && !t.includes(',')) return quote(t);
        return `[ ${t.split(/\s*,\s*/).filter(Boolean).map(v => quote(v)).join(', ')} ]`;
    }

    private emitDistributions(sections: Section[]): void {
        const line = sections[0].heading?.line ?? 1;
        this.b.blank();
        this.b.open('distributions', line);
        for (const s of sections) {
            const parts = collect([...s.blocks, ...s.children.flatMap(c => c.blocks)], NO_LABEL);
            parts.description = undefined;
            for (const table of parts.tables.splice(0, parts.tables.length)) {
                const fi = columnOf(table, 'field', 'path', 'column');
                if (fi === -1) {
                    this.b.unmapped({ line: table.line }, `table with columns ${table.header.join(', ')}`, 'expected a field column');
                    continue;
                }
                table.rows.forEach((row, n) => {
                    const rec = rowRecord(table, row);
                    const field = cell(rec, 'field', 'path', 'column');
                    if (!field) return;
                    const shape = (cell(rec, 'shape', 'distribution', 'law') || 'uniform').toLowerCase();
                    const d: Rec = { shape };
                    const median = numberToken(cell(rec, 'median'));
                    const sigma = numberToken(cell(rec, 'sigma'));
                    const exponent = numberToken(cell(rec, 'exponent', 'skew', 's'));
                    if (median) d.median = Number(median);
                    if (sigma) d.sigma = Number(sigma);
                    if (exponent) d.exponent = Number(exponent);
                    const desc = stripInline(cell(rec, 'description', 'notes', 'meaning'));
                    this.b.line(`${field} ${distributionShape(d)}${desc ? ` :: ${quote(desc)}` : ''}`, table.line + 2 + n);
                });
            }
            for (const list of parts.lists.splice(0, parts.lists.length)) {
                for (const item of list.items) {
                    const { head, tail } = splitDash(item.text);
                    const m = /^`?([A-Za-z_][\w.]*)`?\s*[:：]\s*(uniform|lognormal|zipf)\b(.*)$/i.exec(stripInline(head).replace(/`/g, ''));
                    if (m) this.b.line(`${m[1]} ${m[2].toLowerCase()}${m[3].replace(/\s+/g, ' ').trimEnd()}${tail ? ` :: ${quote(stripInline(tail))}` : ''}`, item.line);
                    else this.b.unmapped({ line: item.line }, `distribution "${item.text}"`, 'expected "path: uniform | lognormal [median m] [sigma s] | zipf [exponent]"');
                }
            }
            this.islands(parts);
            this.reportUnmapped(parts, 'in Distributions');
        }
        this.b.close(line);
    }

    private emitOptions(sections: Section[]): void {
        const line = sections[0].heading?.line ?? 1;
        this.b.blank();
        this.b.open('options', line);
        for (const s of sections) {
            const parts = collect([...s.blocks, ...s.children.flatMap(c => c.blocks)], ANY_LABEL);
            parts.description = undefined;
            const simple = (keyword: string, kind: 'number' | 'fraction' | 'duration', ...labels: string[]): void => {
                const l = this.take(parts, ...labels);
                if (!l) return;
                const v = pathToken(l.value);
                const tok = kind === 'number' ? numberToken(v) : kind === 'fraction' ? fractionToken(v) : durationToken(v.replace(/^"|"$/g, ''));
                if (tok) this.b.line(`${keyword} ${tok}`, l.line);
                else this.b.unmapped({ line: l.line }, `${keyword} "${l.value}"`, `expected a ${kind}`);
            };
            simple('alpha', 'number', 'alpha', 'concentration');
            simple('decimals', 'number', 'decimals', 'decimal places');
            simple('null-rate', 'fraction', 'null rate', 'nulls', 'null probability');
            simple('default-dwell', 'duration', 'default dwell', 'dwell default', 'mean dwell');
            simple('reaction-latency', 'duration', 'reaction latency', 'latency');
            simple('rejections', 'number', 'rejections', 'rejected commands', 'negative fixtures');
            const dwell = this.take(parts, 'dwell', 'dwells', 'dwell times', 'transition dwell');
            const dwellItems = dwell?.list ?? [];
            const table = parts.tables.shift();
            if (dwellItems.length || table) {
                this.b.open('dwell', dwell?.line ?? table!.line);
                for (const i of dwellItems) {
                    const m = /^(\S+)\s*(?:-->|→|->)\s*(\S+?)\s*[:：=]\s*(.+?)\s*$/.exec(stripInline(i.text).replace(/`/g, ''));
                    if (m) this.b.line(`${m[1]} --> ${m[2]} : ${durationToken(m[3].replace(/^"|"$/g, ''))}`, i.line);
                    else this.b.unmapped({ line: i.line }, `dwell "${i.text}"`, 'expected "from --> to: duration"');
                }
                if (table) {
                    const fi = columnOf(table, 'from', 'source');
                    const ti = columnOf(table, 'to', 'target');
                    const di = columnOf(table, 'dwell', 'duration', 'mean', 'time', 'mean dwell');
                    if (fi === -1 || ti === -1 || di === -1) this.b.unmapped({ line: table.line }, `table with columns ${table.header.join(', ')}`, 'expected from, to and dwell columns');
                    else table.rows.forEach((row, n) => this.b.line(`${row[fi].trim()} --> ${row[ti].trim()} : ${durationToken(unquoteCode(row[di]))}`, table.line + 2 + n));
                }
                this.b.close(dwell?.line ?? line);
            }
            this.islands(parts);
            this.reportUnmapped(parts, 'in Options');
        }
        this.b.close(line);
    }
}

export function scenarioFromMarkdown(markdown: string): MarkdownReadResult {
    const { root, blocks } = sectionsOf(markdown);
    const fm = blocks.find(b => b.type === 'frontmatter');
    const header = fm && fm.type === 'frontmatter' ? parseFrontMatter(fm.text) : {};
    const reader = new SynthReader(header);
    reader.read(root);
    return reader.b.result(header);
}
