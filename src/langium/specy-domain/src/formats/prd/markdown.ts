/**
 * The Markdown encoding of a product requirements document — writer and reader.
 *
 * A PRD is the Specy model Markdown fits best: it is how product people write
 * one. The canonical document (what the writer emits) reads like a PRD —
 * `# product Sniplink`, a `## Vision` paragraph, `## Scope` and `## Non-goals`
 * lists, a `## Problem` with its situation / complication / question, then one
 * `## <kind> <Name>` section per persona, job, goal, hypothesis, feature (with
 * `### story US-001 …` sub-sections), assumption, risk, constraint, open
 * question, release and journey, each clause a `**Label:** value` line, the
 * desired outcomes, metrics and journey steps as tables.
 *
 * The reader is tolerant of the way people and language models actually write:
 * group headings (`## Personas` then `### Publisher`), `- Label: value` lists,
 * label aliases, a first paragraph standing for the element's main text, stories
 * as a nested list, steps as a list. It transpiles to DSL through DslBuilder;
 * what it cannot place is reported as unmapped on its Markdown line, a missing
 * required clause is an error naming the label (and a placeholder keeps the
 * DSL parseable, so a best-effort model still comes out).
 */
import type { Block, ListItem } from '../kit/markdown-blocks.js';
import { quote } from '../kit/dsl.js';
import { MarkdownWriter } from '../kit/markdown-writer.js';
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
    type Section,
} from '../kit/markdown-reader.js';
import type { PrdDesignReference, PrdDocument, PrdFeature, PrdJourney, PrdProduct, PrdStep } from './model.js';

type Rec = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Kinds — one table drives the writer's headings and the reader's matching
// ---------------------------------------------------------------------------

export const PRD_KINDS: KindSpec[] = [
    { kind: 'evidence', words: ['supporting evidence'], group: ['evidence', 'supporting evidence'] },
    { kind: 'persona', words: ['user persona', 'actor'], group: ['personas', 'users', 'actors'] },
    { kind: 'job', words: ['job to be done', 'jtbd'], group: ['jobs', 'jobs to be done', 'jtbd'] },
    { kind: 'goal', words: ['objective', 'business goal'], group: ['goals', 'objectives', 'business goals'] },
    { kind: 'hypothesis', group: ['hypotheses'] },
    { kind: 'feature', words: ['capability'], group: ['features', 'capabilities'] },
    { kind: 'story', words: ['user story'], group: ['stories', 'user stories'] },
    { kind: 'assumption', group: ['assumptions'] },
    { kind: 'risk', group: ['risks'] },
    { kind: 'constraint', group: ['constraints'] },
    { kind: 'open-question', words: ['open question', 'question'], group: ['open questions', 'questions'] },
    { kind: 'release', words: ['milestone'], group: ['releases', 'roadmap', 'milestones'] },
    { kind: 'journey', words: ['user journey'], group: ['journeys', 'user journeys'] },
];

const PRODUCT_KINDS: KindSpec[] = [{ kind: 'product' }];

/** Product-level sections that are not elements: their heading is the clause. */
const SPECIAL_SECTIONS: Record<string, 'vision' | 'scope' | 'nonGoals' | 'problem'> = {
    vision: 'vision',
    scope: 'scope',
    'in scope': 'scope',
    'non goals': 'nonGoals',
    nongoals: 'nonGoals',
    'out of scope': 'nonGoals',
    problem: 'problem',
    'problem statement': 'problem',
    'the problem': 'problem',
};

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

export function prdToMarkdown(doc: PrdDocument): string {
    const w = new MarkdownWriter();
    w.frontMatter({ specy: 'prd' });
    for (const p of doc.products ?? []) writeProduct(w, p);
    return w.toString();
}

/** Inline when no name holds a comma, else one bullet per name. */
function names(w: MarkdownWriter, label: string, items: string[] | undefined): void {
    if (!items?.length) return;
    if (items.some(s => s.includes(','))) w.labelList(label, items);
    else w.labelInline(label, items);
}

function designReferences(w: MarkdownWriter, refs: PrdDesignReference[] | undefined): void {
    w.labelList('Design references', refs?.map(r => `${r.name} → ${r.url}`));
}

function writeProduct(w: MarkdownWriter, p: PrdProduct): void {
    w.heading(1, `product ${p.name}`);
    if (p.vision !== undefined) {
        w.heading(2, 'Vision');
        w.para(p.vision);
    }
    if (p.scope?.length) {
        w.heading(2, 'Scope');
        w.list(p.scope);
    }
    if (p.nonGoals?.length) {
        w.heading(2, 'Non-goals');
        w.list(p.nonGoals);
    }
    if (p.problem) {
        w.heading(2, 'Problem');
        w.label('Situation', p.problem.situation);
        w.label('Complication', p.problem.complication);
        w.label('Question', p.problem.question);
        w.blank();
    }
    for (const e of p.evidence ?? []) {
        w.heading(2, `evidence ${e.name}`);
        w.label('Type', e.type);
        w.label('Summary', e.summary);
        w.label('Source reference', e.sourceReference);
        w.label('Date', e.date);
        w.label('Confidence', e.confidence);
        w.label('Supports', e.supports);
        w.blank();
    }
    for (const x of p.personas ?? []) {
        w.heading(2, `persona ${x.name}`);
        w.label('Role', x.role);
        w.labelList('Goals', x.goals);
        w.labelList('Frustrations', x.frustrations);
        w.label('Context', x.context);
        w.label('Weight', x.weight);
        w.blank();
    }
    for (const j of p.jobs ?? []) {
        w.heading(2, `job ${j.name}`);
        w.label('Persona', j.persona);
        w.label('Statement', j.statement);
        w.label('Type', j.type);
        w.label('Importance', j.importance);
        w.label('Satisfaction', j.satisfaction);
        names(w, 'Related to', j.relatedTo);
        if (j.desiredOutcomes?.length) {
            w.blank();
            w.para('**Desired outcomes:**');
            w.table(
                ['outcome', 'importance', 'current satisfaction'],
                j.desiredOutcomes.map(o => [o.statement, o.importance, o.currentSatisfaction]),
            );
        }
        w.blank();
    }
    for (const g of p.goals ?? []) {
        w.heading(2, `goal ${g.name}`);
        w.label('Statement', g.statement);
        w.label('Horizon', g.horizon);
        w.label('Owner', g.owner);
        if (g.metrics?.length) {
            w.blank();
            w.para('**Metrics:**');
            w.table(
                ['indicator', 'target', 'baseline', 'measurement'],
                g.metrics.map(m => [m.indicator, m.target, m.baseline ?? '', m.measurement]),
            );
        }
        w.blank();
    }
    for (const h of p.hypotheses ?? []) {
        w.heading(2, `hypothesis ${h.name}`);
        w.label('Intervention', h.intervention);
        w.label('Expected outcome', h.expectedOutcome);
        w.label('Mechanism', h.mechanism);
        w.label('Validation method', h.validationMethod);
        w.label('Status', h.status);
        w.label('Proposes', h.proposes);
        w.label('Predicts', h.predicts);
        names(w, 'Supported by', h.supportedBy);
        w.blank();
    }
    for (const f of p.features ?? []) writeFeature(w, f);
    for (const a of p.assumptions ?? []) {
        w.heading(2, `assumption ${a.name}`);
        w.label('Statement', a.statement);
        w.label('Impact if wrong', a.impactIfWrong);
        w.label('Validation plan', a.validationPlan);
        w.label('Status', a.status);
        names(w, 'Underpins', a.underpins);
        w.blank();
    }
    for (const r of p.risks ?? []) {
        w.heading(2, `risk ${r.name}`);
        w.label('Statement', r.statement);
        w.label('Likelihood', r.likelihood);
        w.label('Impact', r.impact);
        w.label('Mitigation', r.mitigation);
        w.label('Owner', r.owner);
        names(w, 'Threatens', r.threatens);
        w.blank();
    }
    for (const c of p.constraints ?? []) {
        w.heading(2, `constraint ${c.name}`);
        w.label('Statement', c.statement);
        w.label('Source', c.source);
        names(w, 'Constrains', c.constrains);
        w.blank();
    }
    for (const q of p.openQuestions ?? []) {
        w.heading(2, `open-question ${q.name}`);
        w.label('Question', q.question);
        w.label('Context', q.context);
        w.label('Owner', q.owner);
        w.label('Deadline', q.deadline);
        w.label('Status', q.status);
        names(w, 'Blocks', q.blocks);
        w.label('Resolution', q.resolution);
        w.blank();
    }
    for (const r of p.releases ?? []) {
        w.heading(2, `release ${r.name}`);
        w.label('Target date', r.targetDate);
        w.label('Theme', r.theme);
        w.label('Status', r.status);
        names(w, 'Depends on', r.dependsOn);
        w.labelList('Includes', r.includes);
        w.labelList('Entry criteria', r.entryCriteria);
        w.labelList('Exit criteria', r.exitCriteria);
        w.blank();
    }
    for (const j of p.journeys ?? []) writeJourney(w, j);
}

function writeFeature(w: MarkdownWriter, f: PrdFeature): void {
    w.heading(2, `feature ${f.id ? `${f.id} ` : ''}${f.name}`);
    w.label('Summary', f.summary);
    w.label('Persona', f.persona);
    w.label('Value proposition', f.valueProposition);
    w.label('Priority', f.priority);
    w.label('Status', f.status);
    names(w, 'Addresses', f.addresses);
    names(w, 'Advances', f.advances);
    w.label('Tested by', f.testedBy);
    designReferences(w, f.designReferences);
    w.labelList('Non-goals', f.nonGoals);
    w.blank();
    for (const s of f.stories ?? []) {
        w.heading(3, `story ${s.id ? `${s.id} ` : ''}${s.title}`);
        w.labelList(
            'Acceptance criteria',
            s.acceptanceCriteria.map(c => `${c.id ? `${c.id} ` : ''}${c.text}`),
        );
    }
}

const STEP_HEADER = ['step', 'action', 'system response', 'channel', 'emotional tone', 'order'];

function writeJourney(w: MarkdownWriter, j: PrdJourney): void {
    w.heading(2, `journey ${j.name}`);
    w.label('Persona', j.persona);
    w.label('Trigger', j.trigger);
    w.label('Outcome', j.outcome);
    designReferences(w, j.designReferences);
    if (j.steps?.length) {
        w.blank();
        w.para('**Steps:**');
        w.table(
            STEP_HEADER,
            j.steps.map(s => [s.number !== undefined ? String(s.number) : s.name ?? '', s.action ?? '', s.systemResponse ?? '', s.channel ?? '', s.emotionalTone ?? '', s.order !== undefined ? String(s.order) : '']),
        );
    }
    w.blank();
}

// ---------------------------------------------------------------------------
// Reader
// ---------------------------------------------------------------------------

interface Label {
    label: string;
    value: string;
    line: number;
    /** The list that followed an empty-valued label, or the children of a `- Label:` item. */
    list?: ListItem[];
}

interface Parts {
    /** The first plain paragraph (or quote), before any label. */
    description?: string;
    descriptionLine?: number;
    labels: Label[];
    tables: { header: string[]; rows: string[][]; line: number }[];
    lists: { items: ListItem[]; line: number; ordered: boolean }[];
    unmapped: Block[];
}

/** Sort a section's own blocks into the slots an element is written from. */
function collectParts(blocks: Block[]): Parts {
    const parts: Parts = { labels: [], tables: [], lists: [], unmapped: [] };
    let pendingLabel: Label | undefined;
    for (const b of blocks) {
        switch (b.type) {
            case 'paragraph': {
                const labels = parseLabels(b.text);
                if (labels) {
                    for (const l of labels) parts.labels.push({ ...l, line: b.line });
                    const last = parts.labels[parts.labels.length - 1];
                    pendingLabel = last.value === '' ? last : undefined;
                } else if (parts.description === undefined && !parts.labels.length && !parts.tables.length) {
                    parts.description = stripInline(b.text);
                    parts.descriptionLine = b.line;
                    pendingLabel = undefined;
                } else {
                    parts.unmapped.push(b);
                    pendingLabel = undefined;
                }
                break;
            }
            case 'list': {
                if (pendingLabel) {
                    pendingLabel.list = b.items;
                    pendingLabel = undefined;
                } else if (b.items.length && b.items.every(i => parseLabels(i.text)?.length)) {
                    // `- **Priority:** must` — labels written as a bullet list (plain `- Label: value`
                    // items are lifted later, against the labels the element knows: see liftLabelLists)
                    for (const i of b.items) {
                        const l = parseLabels(i.text)![0];
                        parts.labels.push({ label: l.label, value: l.value, line: i.line, list: i.children.length ? i.children : undefined });
                    }
                } else {
                    parts.lists.push({ items: b.items, line: b.line, ordered: b.ordered });
                }
                break;
            }
            case 'table':
                parts.tables.push({ header: b.header, rows: b.rows, line: b.line });
                pendingLabel = undefined;
                break;
            case 'quote':
                if (parts.description === undefined && !parts.labels.length) {
                    parts.description = b.text;
                    parts.descriptionLine = b.line;
                } else parts.unmapped.push(b);
                pendingLabel = undefined;
                break;
            case 'code':
                parts.unmapped.push(b);
                pendingLabel = undefined;
                break;
            default:
                break;
        }
    }
    return parts;
}

const ID_HEAD = /^(FEAT-\d{3}|US-\d{3}|AC-\d{3}-\d{2})\b/;

/**
 * A bullet list whose every item is `Label: value` with labels the element
 * knows is a list of clauses, not a list of texts ("Scope: origination, …" is a
 * scope item, "Priority: must" under a feature is its priority).
 */
function liftLabelLists(parts: Parts, known: Set<string>): void {
    parts.lists = parts.lists.filter(list => {
        const labels = list.items.map(itemLabel);
        if (!list.items.length || !labels.every(l => l && known.has(l.label))) return true;
        list.items.forEach((i, n) => {
            const l = labels[n]!;
            parts.labels.push({ label: l.label, value: l.value, line: i.line, list: i.children.length ? i.children : undefined });
        });
        return false;
    });
}

/** `Label: value`, or `Label:` alone on an item that carries children (the value is the nested list). */
function itemLabel(item: ListItem): { label: string; value: string } | undefined {
    const l = parseItemLabel(item.text);
    if (l) return l;
    const m = /^([A-Za-z][A-Za-z0-9 _-]{0,40}?)\s*:\s*$/.exec(stripInline(item.text));
    return m && item.children.length ? { label: normalizeWord(m[1]), value: '' } : undefined;
}

const PRODUCT_LABELS = new Set(['vision', 'product vision', 'scope', 'in scope', 'non goals', 'nongoals', 'out of scope', 'situation', 'complication', 'question', 'problem situation', 'problem complication', 'problem question', 'key question', 'how might we', 'today', 'context', 'but', 'tension']);

type FieldKind = 'str' | 'word' | 'date' | 'list' | 'block';

interface FieldSpec {
    /** The DSL keyword. */
    keyword: string;
    /** Accepted labels (normalized); the keyword in words is always accepted. */
    labels?: string[];
    kind: FieldKind;
    required?: boolean;
    /** The first paragraph of the section fills this field when its label is absent. */
    primary?: boolean;
    /** The value assumed, with an error, when a required word is missing. */
    fallback?: string;
}

const f = (keyword: string, kind: FieldKind, opts: Partial<FieldSpec> = {}): FieldSpec => ({ keyword, kind, ...opts });

/** The clauses of each element kind, in the grammar's order. */
const ELEMENTS: Record<string, FieldSpec[]> = {
    evidence: [
        f('type', 'word', { required: true, labels: ['evidence type', 'kind'], fallback: 'domain-expertise' }),
        f('summary', 'str', { required: true, primary: true, labels: ['finding', 'description'] }),
        f('source-reference', 'str', { required: true, labels: ['source', 'reference', 'source ref'] }),
        f('date', 'date', { required: true, labels: ['collected', 'when'] }),
        f('confidence', 'word', { required: true, fallback: 'moderate' }),
        f('supports', 'str', { required: true, labels: ['supports goal', 'supports job', 'in support of'] }),
    ],
    persona: [
        f('role', 'str', { required: true, primary: true, labels: ['who', 'description'] }),
        f('goals', 'block', { required: true, labels: ['goal', 'wants', 'needs'] }),
        f('frustrations', 'block', { required: true, labels: ['frustration', 'pain points', 'pains'] }),
        f('context', 'str', { required: true, labels: ['environment', 'usage context'] }),
        f('weight', 'word', { required: true, labels: ['priority', 'importance'], fallback: 'secondary' }),
    ],
    job: [
        f('persona', 'str', { required: true, labels: ['for', 'actor', 'who'] }),
        f('statement', 'str', { required: true, primary: true, labels: ['job statement', 'description'] }),
        f('type', 'word', { required: true, labels: ['job type', 'kind'], fallback: 'functional' }),
        f('importance', 'word', { required: true, fallback: 'important' }),
        f('satisfaction', 'word', { required: true, labels: ['current satisfaction', 'satisfaction today'], fallback: 'underserved' }),
        f('related-to', 'list', { labels: ['related', 'related jobs', 'see also'] }),
    ],
    goal: [
        f('statement', 'str', { required: true, primary: true, labels: ['description', 'objective'] }),
        f('horizon', 'word', { required: true, labels: ['term', 'timeframe', 'time frame'], fallback: 'mid-term' }),
        f('owner', 'str', { required: true, labels: ['owned by', 'accountable'] }),
    ],
    hypothesis: [
        f('intervention', 'str', { required: true, primary: true, labels: ['if', 'we believe', 'change'] }),
        f('expected-outcome', 'str', { required: true, labels: ['then', 'outcome', 'expected', 'we expect'] }),
        f('mechanism', 'str', { required: true, labels: ['because', 'why', 'rationale'] }),
        f('validation-method', 'str', { required: true, labels: ['validation', 'how we test', 'test', 'measured by'] }),
        f('status', 'word', { required: true, fallback: 'proposed' }),
        f('proposes', 'str', { required: true, labels: ['feature', 'proposed feature'] }),
        f('predicts', 'str', { required: true, labels: ['goal', 'predicted goal', 'moves'] }),
        f('supported-by', 'list', { labels: ['evidence', 'supporting evidence', 'support'] }),
    ],
    feature: [
        f('summary', 'str', { required: true, primary: true, labels: ['description', 'what'] }),
        f('persona', 'str', { required: true, labels: ['for', 'actor', 'who', 'target persona'] }),
        f('value-proposition', 'str', { required: true, labels: ['value', 'why', 'benefit'] }),
        f('priority', 'word', { required: true, labels: ['moscow'], fallback: 'should' }),
        f('status', 'word', { required: true, labels: ['state'], fallback: 'proposed' }),
        f('addresses', 'list', { labels: ['jobs', 'addresses jobs', 'job', 'serves'] }),
        f('advances', 'list', { labels: ['goals', 'advances goals', 'goal', 'contributes to'] }),
        f('tested-by', 'str', { labels: ['hypothesis', 'tested by hypothesis', 'validated by'] }),
    ],
    assumption: [
        f('statement', 'str', { required: true, primary: true, labels: ['assumption', 'description', 'we assume'] }),
        f('impact-if-wrong', 'str', { required: true, labels: ['impact', 'if wrong', 'consequence'] }),
        f('validation-plan', 'str', { required: true, labels: ['validation', 'how we validate', 'plan', 'test'] }),
        f('status', 'word', { required: true, fallback: 'unvalidated' }),
        f('underpins', 'list', { labels: ['supports', 'rests under', 'affects'] }),
    ],
    risk: [
        f('statement', 'str', { required: true, primary: true, labels: ['risk', 'description'] }),
        f('likelihood', 'word', { required: true, labels: ['probability'], fallback: 'medium' }),
        f('impact', 'word', { required: true, labels: ['severity'], fallback: 'medium' }),
        f('mitigation', 'word', { required: true, labels: ['strategy', 'response'], fallback: 'mitigate' }),
        f('owner', 'str', { required: true, labels: ['owned by', 'accountable'] }),
        f('threatens', 'list', { labels: ['affects', 'endangers', 'puts at risk'] }),
    ],
    constraint: [
        f('statement', 'str', { required: true, primary: true, labels: ['constraint', 'description'] }),
        f('source', 'word', { required: true, labels: ['origin', 'type', 'kind'], fallback: 'technical' }),
        f('constrains', 'list', { labels: ['applies to', 'affects', 'limits'] }),
    ],
    'open-question': [
        f('question', 'str', { required: true, primary: true, labels: ['description'] }),
        f('context', 'str', { required: true, labels: ['why it matters', 'background'] }),
        f('owner', 'str', { required: true, labels: ['owned by', 'accountable'] }),
        f('deadline', 'date', { required: true, labels: ['due', 'by', 'needed by'] }),
        f('status', 'word', { required: true, fallback: 'open' }),
        f('blocks', 'list', { labels: ['blocking', 'blocked'] }),
        f('resolution', 'str', { labels: ['answer', 'resolved as', 'decision'] }),
    ],
    release: [
        f('target-date', 'str', { labels: ['target', 'date', 'when', 'eta'] }),
        f('theme', 'str', { primary: true, labels: ['description', 'focus'] }),
        f('status', 'word', { labels: ['state'] }),
        f('depends-on', 'list', { labels: ['dependencies', 'depends', 'after', 'requires'] }),
        f('includes', 'block', { labels: ['features', 'scope', 'content', 'ships'] }),
        f('entry-criteria', 'block', { labels: ['entry', 'start criteria', 'prerequisites'] }),
        f('exit-criteria', 'block', { labels: ['exit', 'done criteria', 'definition of done', 'done when'] }),
    ],
    journey: [
        f('trigger', 'str', { required: true, labels: ['starts when', 'start', 'triggered by'] }),
        f('outcome', 'str', { required: true, labels: ['ends with', 'end', 'result', 'success'] }),
    ],
};

/** Labels of the sub-headings and labelled blocks each kind handles apart from ELEMENTS. */
const SPECIAL_LABELS: Record<string, string[]> = {
    job: ['desired outcomes', 'outcomes', 'desired outcome'],
    goal: ['metrics', 'metric', 'success metrics', 'kpis', 'kpi'],
    feature: ['design references', 'designs', 'design', 'mockups', 'non goals', 'nongoals', 'out of scope', 'stories', 'user stories'],
    story: ['acceptance criteria', 'criteria', 'acceptance', 'ac', 'given when then'],
    journey: ['persona', 'for', 'actor', 'who', 'design references', 'designs', 'mockups', 'steps', 'flow'],
};

/** A keyword or enumeration value as the DSL spells it: `Nice to have` -> `nice-to-have`. */
function word(v: string): string {
    return stripInline(unquoteCode(v))
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
        .replace(/[.;,]+$/, '');
}

/** Labels a field answers to: the keyword in words plus its aliases. */
function labelsOf(spec: FieldSpec): string[] {
    return [normalizeWord(spec.keyword), ...(spec.labels ?? []).map(normalizeWord)];
}

const FALLBACK_DATE = '0000-00-00';

class PrdReader {
    readonly b = new DslBuilder('  ');

    constructor(private readonly header: Record<string, string>) {}

    read(root: Section): void {
        const products = root.children.filter(c => matchHeading(c.heading!.text, PRODUCT_KINDS));
        const preamble = collectParts(root.blocks);
        this.reportUnmapped(preamble, 'before the first heading');
        if (!products.length) {
            // A document with one title heading that names no PRD element (`# Sniplink`)
            // is the product itself: people and language models write it that way.
            const title = root.children.length === 1 && !matchHeading(root.children[0].heading!.text, PRD_KINDS) && !groupKind(root.children[0].heading!.text, PRD_KINDS) ? root.children[0] : undefined;
            if (title) {
                const name = unquoteCode(stripInline(title.heading!.text)).replace(/^"|"$/g, '');
                this.b.warn(title.heading!.line, `"${title.heading!.text}" read as product "${name}" (write "# product ${name}" to say so)`, 'MD-DEFAULT-KIND');
                this.emitProduct(title, name, title.heading!.line);
                return;
            }
            const name = this.header.name ?? this.header.product ?? this.header.title ?? 'Untitled';
            this.b.error(1, `no "# product <name>" heading: the document is read as product "${name}"`, 'MD-PRODUCT');
            this.emitProduct({ blocks: [], children: root.children }, name, 1);
            return;
        }
        for (const child of root.children) {
            const m = matchHeading(child.heading!.text, PRODUCT_KINDS);
            if (m) this.emitProduct(child, unquoteCode(m.rest).replace(/^"|"$/g, ''), child.heading!.line);
            else {
                this.b.warn(child.heading!.line, `heading "${child.heading!.text}" is outside any product; its content is not read`, 'MD-HEADING');
                for (const d of flattenAll(child)) this.b.unmapped(d, describeBlock(d), 'outside any product');
            }
        }
    }

    // -----------------------------------------------------------------------
    // leftovers
    // -----------------------------------------------------------------------

    private reportUnmapped(parts: Parts, where: string): void {
        for (const u of parts.unmapped) this.b.unmapped(u, describeBlock(u), where);
        for (const l of parts.labels) this.b.unmapped({ line: l.line }, `label "${l.label}"`, where);
        for (const t of parts.tables) this.b.unmapped({ line: t.line }, `table with columns ${t.header.join(', ')}`, where);
        for (const l of parts.lists) this.b.unmapped({ line: l.line }, `list: ${l.items.map(i => i.text).join(' / ')}`, where);
        if (parts.description !== undefined) this.b.unmapped({ line: parts.descriptionLine ?? 1 }, parts.description, where);
    }

    private take(parts: Parts, labels: string[]): Label | undefined {
        const i = parts.labels.findIndex(l => labels.includes(l.label));
        return i === -1 ? undefined : parts.labels.splice(i, 1)[0];
    }

    /** The strings of a label: its list items, else its value split on `;` / ` · ` (sentences keep their commas). */
    private itemsOf(l: Label | undefined): string[] {
        if (!l) return [];
        if (l.list?.length) return l.list.map(i => stripInline(i.text));
        return l.value ? l.value.split(/\s*(?:;|·)\s*/).map(stripInline).filter(Boolean) : [];
    }

    /** The names of a label: its list items, else its value split on commas too. */
    private namesOf(l: Label | undefined): string[] {
        if (!l) return [];
        if (l.list?.length) return l.list.map(i => stripInline(i.text));
        return splitList(l.value);
    }

    // -----------------------------------------------------------------------
    // product
    // -----------------------------------------------------------------------

    private emitProduct(section: Section, name: string, line: number): void {
        const parts = collectParts(section.blocks);
        liftLabelLists(parts, PRODUCT_LABELS);
        this.b.open(`product ${quote(name)}`, line);

        // the four product-level clauses, as labels under the product heading…
        const vision = this.take(parts, ['vision', 'product vision']);
        if (vision) this.b.line(`vision ${quote(stripInline(vision.value) || this.itemsOf(vision).join(' '))}`, vision.line);
        this.block(parts, 'scope', ['scope', 'in scope']);
        this.block(parts, 'non-goals', ['non goals', 'nongoals', 'out of scope']);
        this.problem(parts, line, false);

        // …or as sections of their own, among the elements, in document order
        let sawVision = Boolean(vision);
        for (const child of section.children) {
            const text = child.heading!.text;
            const special = SPECIAL_SECTIONS[normalizeWord(text).replace(/:$/, '')];
            if (special === 'vision') {
                const p = collectParts(flattenAll(child));
                const v = [p.description, ...p.labels.filter(l => l.label === 'vision').map(l => l.value)].filter(Boolean).join(' ');
                if (v) this.b.line(`vision ${quote(v)}`, child.heading!.line);
                else this.b.unmapped({ line: child.heading!.line }, 'Vision section without a paragraph');
                p.description = undefined;
                p.labels = p.labels.filter(l => l.label !== 'vision');
                this.reportUnmapped(p, 'in the Vision section');
                sawVision = true;
                continue;
            }
            if (special === 'scope' || special === 'nonGoals') {
                const p = collectParts(flattenAll(child));
                const items = [...p.lists.flatMap(l => l.items.map(i => stripInline(i.text))), ...(p.description ? [p.description] : []), ...p.unmapped.filter(u => u.type === 'paragraph').map(u => stripInline((u as { text: string }).text))];
                if (items.length) {
                    this.b.open(special === 'scope' ? 'scope' : 'non-goals', child.heading!.line);
                    for (const it of items) this.b.line(quote(it), child.heading!.line);
                    this.b.close(child.heading!.line);
                } else this.b.unmapped({ line: child.heading!.line }, `${text} section without a list`);
                continue;
            }
            if (special === 'problem') {
                const p = collectParts(flattenAll(child, true));
                liftLabelLists(p, PRODUCT_LABELS);
                this.problem(p, child.heading!.line, true);
                this.reportUnmapped(p, 'in the Problem section');
                continue;
            }
            this.emitElementSection(child, undefined, parts, sawVision);
        }
        // a lone first paragraph under the product is its vision when none was given
        if (parts.description !== undefined) {
            if (!sawVision) {
                this.b.warn(parts.descriptionLine!, 'the paragraph under the product heading is read as its vision', 'MD-VISION');
                this.b.line(`vision ${quote(parts.description)}`, parts.descriptionLine);
            } else this.b.unmapped({ line: parts.descriptionLine! }, parts.description, 'in the product');
            parts.description = undefined;
        }
        this.reportUnmapped(parts, `in product ${name}`);
        this.b.close(line);
    }

    private problem(parts: Parts, line: number, sectionForm: boolean): void {
        const s = this.take(parts, ['situation', 'problem situation', 'today', 'context']);
        const c = this.take(parts, ['complication', 'problem complication', 'but', 'tension']);
        const q = this.take(parts, ['question', 'problem question', 'key question', 'how might we']);
        if (!s && !c && !q) {
            if (sectionForm) this.b.error(line, 'the Problem section needs **Situation:**, **Complication:** and **Question:** lines', 'MD-MISSING');
            return;
        }
        const need = (l: Label | undefined, label: string): string => {
            if (l) return quote(stripInline(l.value) || this.itemsOf(l).join(' '));
            this.b.error(line, `the problem statement needs a **${label}:** line`, 'MD-MISSING');
            return '""';
        };
        this.b.open('problem', line);
        this.b.line(`situation ${need(s, 'Situation')}`, s?.line ?? line);
        this.b.line(`complication ${need(c, 'Complication')}`, c?.line ?? line);
        this.b.line(`question ${need(q, 'Question')}`, q?.line ?? line);
        this.b.close(line);
    }

    private block(parts: Parts, keyword: string, labels: string[]): void {
        const l = this.take(parts, labels);
        if (!l) return;
        const items = this.itemsOf(l);
        if (!items.length) {
            this.b.unmapped({ line: l.line }, `label "${l.label}" without items`);
            return;
        }
        this.b.open(keyword, l.line);
        for (const it of items) this.b.line(quote(it), l.line);
        this.b.close(l.line);
    }

    // -----------------------------------------------------------------------
    // elements
    // -----------------------------------------------------------------------

    /** A section under the product: a group, an element, or a transparent heading. */
    private emitElementSection(child: Section, defaultKind: string | undefined, productParts: Parts, sawVision: boolean): void {
        void productParts;
        void sawVision;
        const text = child.heading!.text;
        const gk = groupKind(text, PRD_KINDS);
        if (gk) {
            this.reportUnmapped(collectParts(child.blocks), `under the group heading "${text}"`);
            for (const c of child.children) this.emitElementSection(c, gk, productParts, sawVision);
            return;
        }
        const m = this.matchElement(text, defaultKind);
        if (m) {
            if (m.kind === 'story') {
                this.b.error(child.heading!.line, `story "${m.rest}" is outside any feature; put it under a "## feature …" heading`, 'MD-STORY');
                return;
            }
            this.emitElement(child, m.kind, m.rest, m.defaulted);
            return;
        }
        this.b.warn(child.heading!.line, `heading "${text}" names no PRD element; its sub-headings are read in place`, 'MD-HEADING');
        this.reportUnmapped(collectParts(child.blocks), `under the heading "${text}"`);
        for (const c of child.children) this.emitElementSection(c, defaultKind, productParts, sawVision);
    }

    private matchElement(text: string, defaultKind: string | undefined): { kind: string; rest: string; defaulted: boolean } | undefined {
        const clean = stripInline(text).trim();
        const id = ID_HEAD.exec(clean);
        if (id) {
            const kind = id[1].startsWith('FEAT') ? 'feature' : id[1].startsWith('US') ? 'story' : undefined;
            if (kind) return { kind, rest: clean, defaulted: false };
        }
        return matchHeading(clean, PRD_KINDS, defaultKind);
    }

    private emitElement(section: Section, kind: string, rest: string, defaulted: boolean): void {
        const line = section.heading!.line;
        // sub-sections that are elements (stories under a feature) stay sections; the others are
        // absorbed: a sub-heading named like a label becomes that label, anything else joins the blocks
        const own: Section[] = [];
        const stories: Section[] = [];
        const siblings: Section[] = [];
        for (const c of section.children) {
            const m = this.matchElement(c.heading!.text, undefined);
            const g = groupKind(c.heading!.text, PRD_KINDS);
            if (kind === 'feature' && (m?.kind === 'story' || g === 'story')) stories.push(c);
            else if (m || g) siblings.push(c);
            else own.push(c);
        }
        const parts = collectParts(section.blocks);
        for (const sub of own) this.absorb(parts, sub, kind);
        liftLabelLists(parts, knownLabels(kind));

        let name = unquoteCode(rest).replace(/^"|"$/g, '');
        let id: string | undefined;
        if (kind === 'feature') {
            const m = /^(FEAT-\d{3})\s*[:—–-]?\s*(.*)$/.exec(name);
            if (m) {
                id = m[1];
                name = m[2].trim() || name;
            }
        }
        if (defaulted) this.b.warn(line, `"${section.heading!.text}" read as ${kind} "${name}" (from the group heading above it)`, 'MD-DEFAULT-KIND');

        if (kind === 'journey') {
            const persona = this.take(parts, ['persona', 'for', 'actor', 'who', 'user']);
            if (!persona) this.b.error(line, `journey "${name}" needs a **Persona:** line`, 'MD-MISSING');
            this.b.open(`journey ${quote(name)} for ${quote(persona ? stripInline(persona.value) : '')}`, line);
        } else if (kind === 'feature') {
            this.b.open(`feature ${id ? `${id} ` : ''}${quote(name)}`, line);
        } else {
            this.b.open(`${kind} ${quote(name)}`, line);
        }

        // the first paragraph stands for the element's main text
        const specs = ELEMENTS[kind] ?? [];
        const primary = specs.find(s => s.primary);
        if (parts.description !== undefined && primary && !parts.labels.some(l => labelsOf(primary).includes(l.label))) {
            parts.labels.unshift({ label: normalizeWord(primary.keyword), value: parts.description, line: parts.descriptionLine ?? line });
            parts.description = undefined;
        }

        for (const spec of specs) this.field(parts, spec, kind, name, line);

        switch (kind) {
            case 'job':
                this.desiredOutcomes(parts);
                break;
            case 'goal':
                this.metrics(parts);
                break;
            case 'feature':
                this.designReferences(parts);
                this.block(parts, 'non-goals', ['non goals', 'nongoals', 'out of scope']);
                this.stories(parts, stories, line);
                break;
            case 'journey':
                this.designReferences(parts);
                this.steps(parts);
                break;
            default:
                break;
        }
        this.reportUnmapped(parts, `in ${kind} "${name}"`);
        this.b.close(line);
        this.b.blank();
        for (const s of siblings) this.emitElementSection(s, undefined, parts, true);
    }

    /** A sub-heading inside an element: a label when its name is one, else its blocks join the element's. */
    private absorb(parts: Parts, sub: Section, kind: string): void {
        const known = knownLabels(kind);
        const label = normalizeWord(sub.heading!.text).replace(/:$/, '');
        const blocks = flattenAll(sub);
        if (known.has(label)) {
            const p = collectParts(blocks);
            const list = p.lists.shift();
            const value = [p.description, ...p.unmapped.filter(u => u.type === 'paragraph').map(u => stripInline((u as { text: string }).text))].filter(Boolean).join(' ');
            parts.labels.push({ label, value, line: sub.heading!.line, list: list?.items });
            parts.tables.push(...p.tables);
            for (const l of p.labels) parts.labels.push(l);
            for (const extra of p.lists) parts.lists.push(extra);
            return;
        }
        const p = collectParts(blocks);
        if (p.description !== undefined) parts.unmapped.push({ type: 'paragraph', line: p.descriptionLine ?? sub.heading!.line, endLine: p.descriptionLine ?? sub.heading!.line, text: p.description });
        parts.labels.push(...p.labels);
        parts.tables.push(...p.tables);
        parts.lists.push(...p.lists);
        parts.unmapped.push(...p.unmapped);
        this.b.warn(sub.heading!.line, `sub-heading "${sub.heading!.text}" is not a clause of a ${kind}; its content is read as part of the ${kind}`, 'MD-HEADING');
    }

    private field(parts: Parts, spec: FieldSpec, kind: string, name: string, line: number): void {
        const l = this.take(parts, labelsOf(spec));
        const where = l?.line ?? line;
        switch (spec.kind) {
            case 'str': {
                if (l) {
                    const v = stripInline(l.value) || this.itemsOf(l).join(' ');
                    this.b.line(`${spec.keyword} ${quote(v)}`, where);
                } else if (spec.required) {
                    this.b.error(line, `${kind} "${name}" needs a **${title(spec.keyword)}:** line`, 'MD-MISSING');
                    this.b.line(`${spec.keyword} ""`, line);
                }
                return;
            }
            case 'word': {
                if (l && stripInline(l.value)) {
                    this.b.line(`${spec.keyword} ${word(l.value)}`, where);
                } else if (spec.required) {
                    this.b.error(line, `${kind} "${name}" needs a **${title(spec.keyword)}:** line; assuming ${spec.fallback}`, 'MD-MISSING');
                    this.b.line(`${spec.keyword} ${spec.fallback}`, line);
                }
                return;
            }
            case 'date': {
                if (l) {
                    const v = unquoteCode(stripInline(l.value));
                    const m = /(\d{4}-\d{2}-\d{2})/.exec(v);
                    if (m) this.b.line(`${spec.keyword} ${m[1]}`, where);
                    else {
                        this.b.error(where, `${kind} "${name}": **${title(spec.keyword)}:** must be a YYYY-MM-DD date, not "${v}"`, 'MD-DATE');
                        this.b.line(`${spec.keyword} ${FALLBACK_DATE}`, where);
                    }
                } else if (spec.required) {
                    this.b.error(line, `${kind} "${name}" needs a **${title(spec.keyword)}:** date`, 'MD-MISSING');
                    this.b.line(`${spec.keyword} ${FALLBACK_DATE}`, line);
                }
                return;
            }
            case 'list': {
                const items = this.namesOf(l);
                if (items.length) this.b.line(`${spec.keyword} ${items.map(quote).join(', ')}`, where);
                return;
            }
            case 'block': {
                const items = this.itemsOf(l);
                if (!items.length) {
                    if (spec.required) {
                        this.b.error(line, `${kind} "${name}" needs a **${title(spec.keyword)}:** list`, 'MD-MISSING');
                        this.b.line(`${spec.keyword} { "" }`, line);
                    }
                    return;
                }
                this.b.open(spec.keyword, where);
                for (const it of items) this.b.line(quote(it), where);
                this.b.close(where);
                return;
            }
        }
    }

    // -----------------------------------------------------------------------
    // the tables and lists of jobs, goals, features, journeys
    // -----------------------------------------------------------------------

    private desiredOutcomes(parts: Parts): void {
        const l = this.take(parts, ['desired outcomes', 'outcomes', 'desired outcome']);
        const t = this.takeTable(parts, ['outcome', 'statement', 'desired outcome'], ['importance']);
        const rows: { statement: string; importance: string; satisfaction: string; line: number }[] = [];
        if (t) {
            for (const [n, row] of t.rows.entries()) {
                const rec = rowRecord(t, row);
                rows.push({ statement: cell(rec, 'outcome', 'statement', 'desired outcome'), importance: cell(rec, 'importance'), satisfaction: cell(rec, 'current satisfaction', 'satisfaction', 'current'), line: t.line + 2 + n });
            }
        }
        const items = l?.list ?? (!t && l && l.value ? [] : []);
        for (const item of items) {
            const { statement, importance, satisfaction } = outcomeFromItem(item);
            rows.push({ statement, importance, satisfaction, line: item.line });
        }
        if (l && !l.list?.length && l.value && !t) {
            const { statement, importance, satisfaction } = outcomeFromItem({ text: l.value, line: l.line, children: [] });
            rows.push({ statement, importance, satisfaction, line: l.line });
        }
        if (!rows.length) return;
        const at = l?.line ?? t!.line;
        this.b.open('desired-outcomes', at);
        for (const r of rows) {
            if (!r.importance || !r.satisfaction) this.b.error(r.line, `desired outcome "${r.statement}" needs an importance and a current satisfaction (high, medium, low)`, 'MD-MISSING');
            this.b.open(quote(r.statement), r.line);
            this.b.line(`importance ${word(r.importance || 'medium')}`, r.line);
            this.b.line(`current-satisfaction ${word(r.satisfaction || 'medium')}`, r.line);
            this.b.close(r.line);
        }
        this.b.close(at);
    }

    private metrics(parts: Parts): void {
        const l = this.take(parts, ['metrics', 'metric', 'success metrics', 'kpis', 'kpi']);
        const t = this.takeTable(parts, ['indicator', 'metric', 'kpi'], ['target']);
        const rows: { indicator: string; target: string; baseline?: string; measurement: string; line: number }[] = [];
        if (t) {
            for (const [n, row] of t.rows.entries()) {
                const rec = rowRecord(t, row);
                rows.push({ indicator: cell(rec, 'indicator', 'metric', 'kpi'), target: cell(rec, 'target'), baseline: cell(rec, 'baseline', 'today', 'current') || undefined, measurement: cell(rec, 'measurement', 'measured by', 'how', 'method'), line: t.line + 2 + n });
            }
        }
        for (const item of l?.list ?? []) {
            const rec = recordFromItem(item);
            rows.push({
                indicator: rec.indicator ?? rec.metric ?? rec.kpi ?? rec._head ?? '',
                target: rec.target ?? '',
                baseline: rec.baseline ?? rec.today ?? rec.current,
                measurement: rec.measurement ?? rec['measured by'] ?? rec.how ?? rec.method ?? '',
                line: item.line,
            });
        }
        if (!rows.length) {
            if (l) this.b.unmapped({ line: l.line }, 'metrics without a table or a list', 'expected columns indicator, target, baseline, measurement');
            return;
        }
        for (const r of rows) {
            if (!r.indicator || !r.target || !r.measurement) this.b.error(r.line, `metric "${r.indicator}" needs an indicator, a target and a measurement`, 'MD-MISSING');
            this.b.open('metric', r.line);
            this.b.line(`indicator ${quote(r.indicator)}`, r.line);
            this.b.line(`target ${quote(r.target)}`, r.line);
            if (r.baseline) this.b.line(`baseline ${quote(r.baseline)}`, r.line);
            this.b.line(`measurement ${quote(r.measurement)}`, r.line);
            this.b.close(r.line);
        }
    }

    private designReferences(parts: Parts): void {
        const l = this.take(parts, ['design references', 'designs', 'design', 'mockups', 'design refs']);
        if (!l) return;
        const items = l.list?.map(i => i.text) ?? (l.value ? [l.value] : []);
        if (!items.length) return;
        this.b.open('design-references', l.line);
        for (const raw of items) {
            const link = /^\s*\[([^\]]+)\]\(([^)]+)\)\s*$/.exec(raw);
            const m = link ? [raw, link[1], link[2]] : /^(.*?)\s*(?:→|->|=>|—|–|:)\s*(\S+)\s*$/.exec(stripInline(raw));
            if (m) this.b.line(`${quote(stripInline(m[1]))} -> ${quote(unquoteCode(m[2]))}`, l.line);
            else this.b.unmapped({ line: l.line }, `design reference "${raw}"`, 'expected "name → url"');
        }
        this.b.close(l.line);
    }

    private stories(parts: Parts, sections: Section[], line: number): void {
        type Story = { id?: string; title: string; criteria: { id?: string; text: string }[]; line: number };
        const stories: Story[] = [];
        const criteriaOf = (items: ListItem[]): Story['criteria'] =>
            items.map(i => {
                const t = stripInline(i.text).replace(/^\[[ xX]?\]\s*/, '');
                const m = /^(AC-\d{3}-\d{2})\s*[:—–-]?\s*(.*)$/.exec(t);
                return m ? { id: m[1], text: m[2] } : { text: t };
            });
        const storyHead = (text: string): { id?: string; title: string } => {
            const t = stripInline(text).replace(/^"|"$/g, '');
            const m = /^(US-\d{3})\s*[:—–-]?\s*(.*)$/.exec(t);
            return m ? { id: m[1], title: m[2].trim() } : { title: t };
        };
        // stories as sections (or under a "Stories" group)
        const walk = (s: Section): void => {
            if (groupKind(s.heading!.text, PRD_KINDS) === 'story') {
                this.reportUnmapped(collectParts(s.blocks), `under the group heading "${s.heading!.text}"`);
                for (const c of s.children) walk(c);
                return;
            }
            const m = this.matchElement(s.heading!.text, 'story');
            const head = storyHead(m?.rest ?? s.heading!.text);
            const p = collectParts(s.blocks);
            for (const sub of s.children) this.absorb(p, sub, 'story');
            liftLabelLists(p, knownLabels('story'));
            const ac = this.take(p, ['acceptance criteria', 'criteria', 'acceptance', 'ac', 'given when then']);
            const bare = !ac ? p.lists.shift() : undefined;
            const items = ac?.list ?? bare?.items ?? [];
            if (!items.length) this.b.error(s.heading!.line, `story "${head.title}" needs an **Acceptance criteria:** list`, 'MD-MISSING');
            if (p.description !== undefined && !head.title) head.title = p.description;
            else if (p.description !== undefined) this.b.unmapped({ line: p.descriptionLine! }, p.description, `in story "${head.title}"`);
            p.description = undefined;
            this.reportUnmapped(p, `in story "${head.title}"`);
            stories.push({ ...head, criteria: items.length ? criteriaOf(items) : [{ text: '' }], line: s.heading!.line });
        };
        for (const s of sections) walk(s);
        // stories as a nested list under a label
        const l = this.take(parts, ['stories', 'user stories']);
        for (const item of l?.list ?? []) {
            const { head, tail } = splitDash(item.text);
            const h = storyHead(head);
            if (tail) h.title = `${h.title} — ${tail}`.replace(/^ — /, '');
            if (!item.children.length) this.b.error(item.line, `story "${h.title}" needs its acceptance criteria as a nested list`, 'MD-MISSING');
            stories.push({ ...h, criteria: item.children.length ? criteriaOf(item.children) : [{ text: '' }], line: item.line });
        }
        if (!stories.length) return;
        this.b.open('stories', stories[0]?.line ?? line);
        for (const s of stories) {
            this.b.open(`${s.id ? `${s.id} ` : ''}${quote(s.title)}`, s.line);
            this.b.open('acceptance-criteria', s.line);
            for (const c of s.criteria) this.b.line(`${c.id ? `${c.id} ` : ''}${quote(c.text)}`, s.line);
            this.b.close(s.line);
            this.b.close(s.line);
        }
        this.b.close(line);
    }

    private steps(parts: Parts): void {
        const l = this.take(parts, ['steps', 'flow', 'journey steps']);
        const t = this.takeTable(parts, ['step', '#', 'name', 'action'], []);
        const steps: (PrdStep & { line: number })[] = [];
        const fromRecord = (rec: Record<string, string | undefined>, head: string | undefined, line: number): PrdStep & { line: number } => {
            const stepCell = head ?? rec.step ?? rec['#'] ?? rec.name ?? rec.n ?? '';
            const num = /^(?:step\s+)?(\d+)$/i.exec(stepCell.trim());
            const s: PrdStep & { line: number } = { line };
            if (num) s.number = Number(num[1]);
            else if (stepCell) s.name = stepCell;
            const action = rec.action ?? rec.does ?? rec['user action'];
            if (action) s.action = action;
            const sr = rec['system response'] ?? rec.response ?? rec.system ?? rec['system reaction'];
            if (sr) s.systemResponse = sr;
            const ch = rec.channel ?? rec.where ?? rec.touchpoint;
            if (ch) s.channel = word(ch);
            const tone = rec['emotional tone'] ?? rec.tone ?? rec.emotion ?? rec.feeling;
            if (tone) s.emotionalTone = word(tone);
            const order = rec.order ?? rec.sequence ?? rec.position;
            if (order && /^\d+$/.test(order.trim())) s.order = Number(order);
            if (!s.number && !s.name && action) {
                // a table without a step column: the action names the step
                s.name = action;
                delete s.action;
            }
            return s;
        };
        if (t) {
            for (const [n, row] of t.rows.entries()) {
                const rec = rowRecord(t, row);
                const clean: Record<string, string | undefined> = {};
                for (const [k, v] of Object.entries(rec)) clean[k] = unquoteCode(v) || undefined;
                steps.push(fromRecord(clean, undefined, t.line + 2 + n));
            }
        }
        for (const item of l?.list ?? []) {
            const rec = recordFromItem(item);
            const head = rec._head;
            delete rec._head;
            steps.push(fromRecord(rec, head, item.line));
        }
        if (!steps.length) {
            if (l) this.b.unmapped({ line: l.line }, 'steps without a table or a list', 'expected columns step, action, system response, channel, emotional tone, order');
            return;
        }
        const at = l?.line ?? t!.line;
        this.b.open('steps', at);
        for (const s of steps) {
            this.b.open(s.number !== undefined ? `step ${s.number}` : quote(s.name ?? ''), s.line);
            if (s.action !== undefined) this.b.line(`action ${quote(s.action)}`, s.line);
            if (s.systemResponse !== undefined) this.b.line(`system-response ${quote(s.systemResponse)}`, s.line);
            if (s.channel !== undefined) this.b.line(`channel ${s.channel}`, s.line);
            if (s.emotionalTone !== undefined) this.b.line(`emotional-tone ${s.emotionalTone}`, s.line);
            if (s.order !== undefined) this.b.line(`order ${s.order}`, s.line);
            this.b.close(s.line);
        }
        this.b.close(at);
    }

    /** The first table that has one of `keys` and all of `also`. */
    private takeTable(parts: Parts, keys: string[], also: string[]): Parts['tables'][number] | undefined {
        const i = parts.tables.findIndex(t => keys.some(k => columnOf(t, k) !== -1) && also.every(k => columnOf(t, k) !== -1));
        return i === -1 ? undefined : parts.tables.splice(i, 1)[0];
    }
}

/** `statement — importance: high, current satisfaction: medium` (or `(importance high, satisfaction low)`). */
function outcomeFromItem(item: ListItem): { statement: string; importance: string; satisfaction: string } {
    const text = stripInline(item.text);
    const importance = /importance\s*[:=]?\s*(high|medium|low)/i.exec(text)?.[1] ?? '';
    const satisfaction = /satisfaction\s*[:=]?\s*(high|medium|low)/i.exec(text)?.[1] ?? '';
    const children = item.children.map(c => parseItemLabel(c.text)).filter(Boolean) as { label: string; value: string }[];
    const ci = children.find(c => c.label === 'importance')?.value ?? '';
    const cs = children.find(c => /satisfaction/.test(c.label))?.value ?? '';
    const statement = text
        .replace(/\s*[—–(-]\s*importance.*$/i, '')
        .replace(/\s*[—–(-]\s*(current\s+)?satisfaction.*$/i, '')
        .replace(/[()]/g, '')
        .trim();
    return { statement, importance: importance || ci, satisfaction: satisfaction || cs };
}

/** A list item with `Label: value` children (and optionally `Label: value` pairs in its own text) as a record; `_head` is the plain head. */
function recordFromItem(item: ListItem): Record<string, string | undefined> {
    const rec: Record<string, string | undefined> = {};
    const own = itemLabel(item);
    if (own) rec[own.label] = stripInline(own.value);
    else {
        const { head, tail } = splitDash(item.text);
        rec._head = stripInline(head);
        if (tail) {
            // `target: 500 · baseline: 0 · measurement: weekly`
            for (const part of tail.split(/\s*[·;|]\s*/)) {
                const m = /^([A-Za-z][\w ]{0,30}?)\s*[:=]\s*(.+)$/.exec(stripInline(part));
                if (m) rec[normalizeWord(m[1])] = m[2].trim();
            }
        }
    }
    for (const c of item.children) {
        const l = itemLabel(c);
        if (l) rec[l.label] = stripInline(l.value) || (c.children.length ? c.children.map(x => stripInline(x.text)).join('; ') : '');
    }
    return rec;
}

/** Every label an element kind answers to. */
function knownLabels(kind: string): Set<string> {
    return new Set([...(ELEMENTS[kind] ?? []).flatMap(labelsOf), ...(SPECIAL_LABELS[kind] ?? []).map(normalizeWord)]);
}

function title(keyword: string): string {
    const s = keyword.replace(/-/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/** All blocks of a section and its descendants; headings of the descendants become label-like paragraphs when asked. */
function flattenAll(section: Section, headingsAsLabels = false): Block[] {
    const out: Block[] = [...section.blocks];
    for (const c of section.children) {
        if (headingsAsLabels && c.heading) {
            // `### Situation` + paragraph -> `**Situation:** paragraph`
            const p = collectParts(c.blocks);
            const text = [p.description, ...p.unmapped.filter(u => u.type === 'paragraph').map(u => (u as { text: string }).text)].filter(Boolean).join(' ');
            out.push({ type: 'paragraph', line: c.heading.line, endLine: c.heading.line, text: `**${c.heading.text}:** ${text}` });
            for (const b of c.blocks) if (b.type !== 'paragraph') out.push(b);
            for (const g of c.children) out.push(...flattenAll(g, headingsAsLabels));
        } else {
            out.push(...flattenAll(c, headingsAsLabels));
        }
    }
    return out;
}

export function prdFromMarkdown(markdown: string): ReturnType<DslBuilder['result']> {
    const { root, blocks } = sectionsOf(markdown);
    const fm = blocks.find(b => b.type === 'frontmatter');
    const header = fm && fm.type === 'frontmatter' ? parseFrontMatter(fm.text) : {};
    const reader = new PrdReader(header);
    reader.read(root);
    return reader.b.result(header);
}

export { collectParts as prdCollectParts };
export type { Rec as PrdRec };
