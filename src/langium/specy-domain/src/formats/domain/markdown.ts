/**
 * The Markdown encoding of a domain model — writer and reader.
 *
 * Writer (model -> Markdown): the canonical document of
 * src/metamodels/MODEL-FORMATS.md. Headings carry the containment and the
 * kind (`# organization Acme` > `## context Sales (SLS)` > `### module Quoting`
 * > `#### entity Quote`); the first paragraph under a heading is its `::`
 * description; `**Label:** value` lines are the simple clauses; a pipe table is
 * the fields block; bullet lists are the name lists (references, enum values,
 * subdomains, the context map); fenced `specy` islands hold what Markdown has no
 * good shape for — operations, state machines, invariants, reconciliations —
 * in DSL syntax, printed by the DSL printer.
 *
 * Reader (Markdown -> DSL): tolerant of the spellings an author or a language
 * model uses (`Entity: Quote`, `Quote (entity)`, a bare `Quote` under an
 * `## Entities` group heading, `**Identity**:` or `- Identity:`), it transpiles
 * what it recognizes to DSL and reports the rest as unmapped, line by line.
 */
import type { ConstructModel, ContextModel, DefinitionGroups, DomainModel, FieldModel, ModuleModel, OperationModel, OrganizationModel } from '../../cli/domain-model.js';
import type { Block } from '../kit/markdown-blocks.js';
import { metaPairs, parseMetaPairs, quote } from '../kit/dsl.js';
import { MarkdownWriter, code } from '../kit/markdown-writer.js';
import {
    DslBuilder,
    cell,
    columnOf,
    describeBlock,
    flattenBlocks,
    groupKind,
    matchHeading,
    parseFlag,
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
import { printExpression } from './expressions.js';
import {
    GROUP_ORDER,
    fieldLine,
    invariantsIsland,
    kindHeadSuffix,
    kindKeyword,
    operationsIsland,
    printConstraint,
    reconciliationIsland,
    referenceLine,
    statesIsland,
    type OperationFlavour,
} from './printer.js';

type Rec = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Kinds — one table drives the writer's headings and the reader's matching
// ---------------------------------------------------------------------------

export const CONTAINER_KINDS: KindSpec[] = [
    { kind: 'organization', words: ['organisation'] },
    { kind: 'context', words: ['bounded context'] },
    { kind: 'module' },
];

export const DEFINITION_KINDS: KindSpec[] = [
    { kind: 'enum', words: ['enumeration'], group: ['enums', 'enumerations'] },
    { kind: 'value', words: ['value type', 'value object'], group: ['values', 'value types', 'value objects'] },
    { kind: 'read-only entity', words: ['read only entity', 'readonly entity', 'master data'] },
    { kind: 'entity', group: ['entities'] },
    { kind: 'aggregate', words: ['aggregate root'], group: ['aggregates'] },
    { kind: 'command', group: ['commands'] },
    { kind: 'query', group: ['queries'] },
    { kind: 'external event', group: ['external events'] },
    { kind: 'error event', group: ['error events'] },
    { kind: 'temporal event', group: ['temporal events'] },
    { kind: 'event', words: ['domain event'], group: ['events', 'domain events'] },
    { kind: 'domain service', words: ['service'], group: ['services', 'domain services'] },
    { kind: 'application service', words: ['app service'], group: ['application services'] },
    { kind: 'infrastructure service', words: ['infra service'], group: ['infrastructure services'] },
    { kind: 'read-only repository', words: ['read only repository'] },
    { kind: 'repository', group: ['repositories'] },
    { kind: 'api interface', words: ['api', 'driving port'] },
    { kind: 'spi interface', words: ['spi', 'driven port'] },
    { kind: 'interface', words: ['port'], group: ['interfaces', 'ports'] },
    { kind: 'reaction', words: ['policy'], group: ['reactions', 'policies'] },
    { kind: 'invariant', group: ['invariants'] },
    { kind: 'agreement', group: ['agreements'] },
];

const ALL_KINDS = [...CONTAINER_KINDS, ...DEFINITION_KINDS];

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

export function domainToMarkdown(model: DomainModel): string {
    const w = new MarkdownWriter();
    w.frontMatter({ specy: 'domain' });
    for (const org of model.organizations ?? []) writeOrganization(w, org, 1);
    for (const ctx of model.contexts ?? []) writeContext(w, ctx, 1);
    for (const mod of model.modules ?? []) writeModule(w, mod, 1);
    if (model.definitions) writeGroups(w, model.definitions, 1);
    return w.toString();
}

function writeCommon(w: MarkdownWriter, c: { description?: string; satisfies?: string[]; metadata?: Record<string, unknown> }): void {
    w.para(c.description);
    w.labelInline('Satisfies', c.satisfies);
    w.label('Metadata', metaPairs(c.metadata));
}

function writeOrganization(w: MarkdownWriter, org: OrganizationModel, level: number): void {
    const o = org as OrganizationModel & { satisfies?: string[] };
    w.heading(level, `organization ${org.name}`);
    writeCommon(w, o);
    w.label('Requirements source', org.requirementsSource);
    w.labelList(
        'Subdomains',
        org.subdomains?.map(s => `${s.name} ${code(s.classification)}${s.description ? ` — ${s.description}` : ''}${s.metadata && Object.keys(s.metadata).length ? ` · meta: ${metaPairs(s.metadata)}` : ''}`),
    );
    for (const ctx of org.contexts ?? []) writeContext(w, ctx, level + 1);
}

function writeContext(w: MarkdownWriter, ctx: ContextModel, level: number): void {
    const c = ctx as ContextModel & { satisfies?: string[] };
    w.heading(level, `context ${ctx.name}${ctx.shortname ? ` (${ctx.shortname})` : ''}`);
    writeCommon(w, c);
    w.label('Requirements source', ctx.requirementsSource);
    w.labelInline('Models', ctx.models);
    w.labelList(
        'Context map',
        ctx.contextMap?.map(r => `${r.direction} ${r.target} : ${r.pattern}`),
    );
    // The context's own definitions come before its modules, at the modules' level:
    // a heading hierarchy has no other way to keep them out of the last module.
    if (ctx.definitions) writeGroups(w, ctx.definitions, level + 1);
    for (const mod of ctx.modules ?? []) writeModule(w, mod, level + 1);
}

function writeModule(w: MarkdownWriter, mod: ModuleModel, level: number): void {
    const m = mod as ModuleModel & { satisfies?: string[]; requirementsSource?: string };
    w.heading(level, `module ${mod.name}`);
    writeCommon(w, m);
    w.label('Requirements source', m.requirementsSource);
    w.labelInline('Exposes', mod.exposes);
    w.labelInline('Requires', mod.requires);
    w.labelInline('Depends on', mod.dependencies);
    if (mod.definitions) writeGroups(w, mod.definitions, level + 1);
}

function writeGroups(w: MarkdownWriter, groups: DefinitionGroups, level: number): void {
    const keys = Object.keys(groups).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    for (const k of keys) for (const c of groups[k] ?? []) writeDefinition(w, c, level);
}

function rank(key: string): number {
    const i = GROUP_ORDER.indexOf(key);
    return i === -1 ? GROUP_ORDER.length : i;
}

const FIELD_HEADER = ['field', 'type', 'constraints', 'description'];

function writeFields(w: MarkdownWriter, fields: FieldModel[] | undefined): void {
    if (!fields?.length) return;
    const withSatisfies = fields.some(f => f.satisfies?.length);
    const header = withSatisfies ? [...FIELD_HEADER, 'satisfies'] : FIELD_HEADER;
    w.table(
        header,
        fields.map(f => {
            const row = [f.name, code(`${f.type}${f.optional ? '?' : ''}`), (f.constraints ?? []).map(printConstraint).join(' '), f.description ?? ''];
            return withSatisfies ? [...row, (f.satisfies ?? []).join(', ')] : row;
        }),
    );
}

function writeDefinition(w: MarkdownWriter, c: ConstructModel, level: number): void {
    const r = c as ConstructModel & Rec;
    w.heading(level, `${kindKeyword(c)} ${c.name}${kindHeadSuffix(c)}`);
    writeCommon(w, c);
    const id = r.identity as { name: string; type: string } | undefined;
    const islands: (string | undefined)[] = [];
    switch (c.kind) {
        case 'enum':
            w.list(((r.values as Rec[]) ?? []).map(v => `${v.name}${v.value !== undefined ? ` = ${literalText(v.value)}` : ''}${v.description ? ` — ${v.description}` : ''}`));
            break;
        case 'value':
            writeFields(w, c.fields);
            islands.push(operationsIsland(r.operations as OperationModel[] | undefined, 'value'), invariantsIsland(r.invariants as Rec[] | undefined));
            break;
        case 'entity':
        case 'aggregate':
            if (id) w.label('Identity', code(`${id.name} : ${id.type}`));
            if (r.duplicateDetection !== undefined) w.label('Duplicate detection', code(printExpression(r.duplicateDetection)));
            writeFields(w, c.fields);
            if (c.kind === 'aggregate') w.labelInline('Entities', r.entities as string[] | undefined);
            writeReferences(w, r.references as Rec[] | undefined);
            islands.push(operationsIsland(r.operations as OperationModel[] | undefined, 'entity'), statesIsland(r.stateMachines as Rec[] | undefined), invariantsIsland(r.invariants as Rec[] | undefined));
            break;
        case 'read-only-entity':
            w.label('Sourced from', r.sourcedFrom as string | undefined);
            w.label('Synced via', r.syncedVia as string | undefined);
            w.label('Projected by', r.projectedBy as string | undefined);
            if (id) w.label('Identity', code(`${id.name} : ${id.type}`));
            writeFields(w, c.fields);
            writeReferences(w, r.references as Rec[] | undefined);
            islands.push(operationsIsland(r.operations as OperationModel[] | undefined, 'safe'), invariantsIsland(r.invariants as Rec[] | undefined));
            break;
        case 'command':
            if (id) w.label('Identity', code(`${id.name} : ${id.type}`));
            writeFields(w, c.fields);
            break;
        case 'query':
            w.label('Reads from', r.readsFrom as string | undefined);
            writeFields(w, c.fields);
            w.label('Returns', code(r.returns as string | undefined));
            break;
        case 'event':
        case 'error-event':
            w.label('About', r.about as string | undefined);
            w.label('Caused by', r.causedBy as string | undefined);
            writeFields(w, c.fields);
            break;
        case 'external-event':
            w.label('From', r.from as string | undefined);
            w.label('About', r.about as string | undefined);
            writeFields(w, c.fields);
            break;
        case 'temporal-event':
            w.label('About', r.about as string | undefined);
            w.label('Anchor', code(anchorText(r.anchor as Rec)));
            if (r.guard !== undefined) w.label('Guard', code(printExpression(r.guard)));
            writeFields(w, c.fields);
            break;
        case 'domain-service':
            w.labelInline('Calls', r.calls as string[] | undefined);
            islands.push(operationsIsland(r.operations as OperationModel[] | undefined, 'entity'));
            break;
        case 'application-service':
            w.label('Exposed by', r.exposedBy as string | undefined);
            islands.push(operationsIsland(r.operations as OperationModel[] | undefined, 'entity'));
            break;
        case 'infrastructure-service':
            w.label('Described by', r.describedBy as string | undefined);
            islands.push(operationsIsland(r.operations as OperationModel[] | undefined, 'signature'));
            break;
        case 'repository':
            w.label('Described by', r.describedBy as string | undefined);
            islands.push(operationsIsland(r.operations as OperationModel[] | undefined, 'signature'));
            break;
        case 'interface':
            w.labelList('Exposes', (r.exposes as string[] | undefined)?.map(code));
            w.label('Describes', r.describes as string | undefined);
            islands.push(operationsIsland(r.operations as OperationModel[] | undefined, 'signature'));
            break;
        case 'reaction':
            w.labelInline('Triggered by', r.triggeredBy as string[] | undefined);
            if (r.guard !== undefined) w.label('Guard', code(printExpression(r.guard)));
            w.label('Effects', r.effects as string | undefined);
            break;
        case 'invariant':
            w.label('On', code(r.on as string | undefined));
            w.label('Must', code(printExpression(r.must)));
            w.label('Enforcement', r.enforcement as string | undefined);
            break;
        case 'agreement':
            w.labelInline('Participants', r.participants as string[] | undefined);
            w.label('Predicate', code(printExpression(r.predicate)));
            islands.push(reconciliationIsland(r.reconciliation as Rec | undefined));
            break;
        default:
            w.comment(`construct kind "${c.kind}" has no Markdown shape`);
    }
    for (const island of islands) w.code(island);
}

function writeReferences(w: MarkdownWriter, refs: Rec[] | undefined): void {
    w.labelList(
        'References',
        refs?.map(r => `${code(`${r.name} : ${r.target} ${r.cardinality}`)}${r.description ? ` — ${r.description}` : ''}`),
    );
}

function anchorText(a: Rec | undefined): string {
    if (!a) return '';
    if (a.kind === 'relative') return `reference ${a.reference} offset ${printExpression(a.offset)}`;
    if (a.kind === 'absolute') return `instant ${a.instant}`;
    return `schedule ${quote(String(a.schedule ?? ''))}`;
}

function literalText(v: unknown): string {
    return typeof v === 'string' ? quote(v) : String(v);
}

// ---------------------------------------------------------------------------
// Reader
// ---------------------------------------------------------------------------

interface Parts {
    description?: string;
    descriptionLine?: number;
    /** label -> { value, line, list } in document order */
    labels: { label: string; value: string; line: number; list?: string[] }[];
    tables: { header: string[]; rows: string[][]; line: number }[];
    /** Bare lists (no label before them). */
    lists: { items: string[]; line: number }[];
    islands: { text: string; line: number; lang: string }[];
    unmapped: Block[];
}

/** Sort a section's own blocks into the slots a definition or container is written from. */
function collectParts(blocks: Block[]): Parts {
    const parts: Parts = { labels: [], tables: [], lists: [], islands: [], unmapped: [] };
    let pendingLabel: Parts['labels'][number] | undefined;
    for (const b of blocks) {
        switch (b.type) {
            case 'paragraph': {
                const labels = parseLabels(b.text);
                if (labels) {
                    for (const l of labels) parts.labels.push({ ...l, line: b.line });
                    const last = labels[labels.length - 1];
                    pendingLabel = last.value === '' ? parts.labels[parts.labels.length - 1] : undefined;
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
                const items = b.items.map(i => i.text);
                if (pendingLabel) {
                    pendingLabel.list = items;
                    pendingLabel = undefined;
                } else if (b.items.every(i => parseItemLabel(i.text))) {
                    // `- Identity: id : uuid` — labels written as a list
                    for (const i of b.items) {
                        const l = parseItemLabel(i.text)!;
                        parts.labels.push({ label: l.label, value: l.value, line: i.line, list: i.children.length ? i.children.map(c => c.text) : undefined });
                    }
                } else {
                    parts.lists.push({ items, line: b.line });
                }
                break;
            }
            case 'table':
                parts.tables.push({ header: b.header, rows: b.rows, line: b.line });
                pendingLabel = undefined;
                break;
            case 'code':
                parts.islands.push({ text: b.text, line: b.line, lang: b.lang });
                pendingLabel = undefined;
                break;
            case 'quote':
                if (parts.description === undefined) {
                    parts.description = b.text;
                    parts.descriptionLine = b.line;
                } else parts.unmapped.push(b);
                pendingLabel = undefined;
                break;
            case 'comment':
            case 'rule':
            case 'frontmatter':
                break;
            case 'heading':
                break;
        }
    }
    return parts;
}

class DomainReader {
    readonly b = new DslBuilder('  ');

    constructor(private readonly header: Record<string, string>) {}

    read(root: Section): void {
        // Blocks before the first heading: only a description-less preamble is allowed.
        const parts = collectParts(root.blocks);
        this.reportUnmapped(parts, 'before the first heading');
        this.emitChildren(root, undefined);
    }

    private reportUnmapped(parts: Parts, where: string): void {
        for (const u of parts.unmapped) this.b.unmapped(u, describeBlock(u), where);
        for (const l of parts.labels) this.b.unmapped({ line: l.line }, `label "${l.label}"`, where);
        for (const t of parts.tables) this.b.unmapped({ line: t.line }, `table with columns ${t.header.join(', ')}`, where);
        for (const l of parts.lists) this.b.unmapped({ line: l.line }, `list: ${l.items.join(' / ')}`, where);
        for (const i of parts.islands) this.b.unmapped({ line: i.line }, `code block`, where);
        if (parts.description !== undefined) this.b.unmapped({ line: parts.descriptionLine ?? 1 }, parts.description, where);
    }

    private emitChildren(section: Section, defaultKind: string | undefined): void {
        for (const child of section.children) {
            const text = child.heading!.text;
            const gk = groupKind(text, DEFINITION_KINDS);
            if (gk) {
                this.reportUnmapped(collectParts(child.blocks), `under the group heading "${text}"`);
                this.emitChildren(child, gk);
                continue;
            }
            const container = matchHeading(text, CONTAINER_KINDS);
            if (container && !container.defaulted) {
                this.emitContainer(child, container.kind, container.rest);
                continue;
            }
            const def = matchHeading(text, DEFINITION_KINDS, defaultKind);
            if (def) {
                this.emitDefinition(child, def.kind, def.rest, def.defaulted);
                continue;
            }
            // A heading that is neither a kind nor a group: transparent (its children are read in place).
            this.b.warn(child.heading!.line, `heading "${text}" names no domain construct; its sub-headings are read in place`, 'MD-HEADING');
            this.reportUnmapped(collectParts(child.blocks), `under the heading "${text}"`);
            this.emitChildren(child, defaultKind);
        }
    }

    private headText(keyword: string, name: string, parts: Parts, suffix = ''): string {
        const meta = this.take(parts, 'metadata', 'meta');
        const pairs = meta ? parseMetaPairs(meta.value) : [];
        const metaText = pairs.length ? ` meta { ${pairs.map(([k, v]) => `${k} = ${v}`).join(' ')} }` : '';
        const description = parts.description;
        parts.description = undefined;
        return `${keyword} ${name}${suffix}${description ? ` :: ${quote(description)}` : ''}${metaText}`;
    }

    private take(parts: Parts, ...labels: string[]): Parts['labels'][number] | undefined {
        const i = parts.labels.findIndex(l => labels.includes(l.label));
        if (i === -1) return undefined;
        return parts.labels.splice(i, 1)[0];
    }

    private takeAll(parts: Parts, ...labels: string[]): Parts['labels'] {
        const out: Parts['labels'] = [];
        for (let i = parts.labels.length - 1; i >= 0; i--) {
            if (labels.includes(parts.labels[i].label)) out.unshift(parts.labels.splice(i, 1)[0]);
        }
        return out;
    }

    private listOf(l: Parts['labels'][number] | undefined): string[] {
        if (!l) return [];
        if (l.list) return l.list.map(s => unquoteCode(stripInline(s)));
        return splitList(l.value);
    }

    private satisfies(parts: Parts): void {
        const s = this.take(parts, 'satisfies', 'requirements');
        if (s) this.b.line(`satisfies [${this.listOf(s).join(', ')}]`, s.line);
    }

    private emitContainer(section: Section, kind: string, rest: string): void {
        const parts = collectParts(section.blocks);
        const line = section.heading!.line;
        let name = rest;
        let suffix = '';
        if (kind === 'context') {
            const m = /^(\S+)\s*\(\s*([^)]+)\s*\)\s*$/.exec(rest);
            if (m) {
                name = m[1];
                suffix = ` (${m[2].trim()})`;
            }
        }
        name = unquoteCode(name).split(/\s+/)[0];
        this.b.blank();
        this.b.open(this.headText(kind, name, parts, suffix), line);
        this.satisfies(parts);
        const rs = this.take(parts, 'requirements source', 'sysreq', 'requirements file');
        if (rs) this.b.line(`requirements-source ${quote(unquoteCode(rs.value))}`, rs.line);
        if (kind === 'organization') {
            const sub = this.take(parts, 'subdomains', 'subdomain');
            for (const item of this.rawList(sub)) {
                const [body, metaText] = item.split(/\s*·\s*meta(?:data)?\s*:\s*/i);
                const { head, tail } = splitDash(body);
                const m = /^(\S+)\s+[`(]?\s*(core|supporting|generic)\s*[`)]?\s*$/i.exec(stripInline(head).replace(/`/g, ''));
                const pairs = metaText ? parseMetaPairs(metaText) : [];
                const meta = pairs.length ? ` meta { ${pairs.map(([k, v]) => `${k} = ${v}`).join(' ')} }` : '';
                if (m) this.b.line(`subdomain ${m[1]} ${m[2].toLowerCase()}${tail ? ` :: ${quote(stripInline(tail))}` : ''}${meta}`, sub!.line);
                else this.b.unmapped({ line: sub!.line }, `subdomain "${item}"`, 'expected "Name core|supporting|generic — description"');
            }
        }
        if (kind === 'context') {
            const models = this.take(parts, 'models', 'subdomains modelled', 'models subdomains');
            if (models) this.b.line(`models ${this.listOf(models).join(', ')}`, models.line);
            const map = this.take(parts, 'context map', 'map', 'relations');
            const relations = this.rawList(map);
            if (relations.length) {
                this.b.open('map', map!.line);
                for (const r of relations) {
                    const m = /^(upstream|downstream|symmetric)\s+(\S+)\s*[:→-]+\s*(\S+)\s*$/i.exec(stripInline(r).replace(/`/g, ''));
                    if (m) this.b.line(`${m[1].toLowerCase()} ${m[2]} : ${m[3]}`, map!.line);
                    else this.b.unmapped({ line: map!.line }, `context-map entry "${r}"`, 'expected "downstream|upstream|symmetric Name : Pattern"');
                }
                this.b.close(map!.line);
            }
        }
        if (kind === 'module') {
            const ex = this.take(parts, 'exposes', 'exposes api', 'api');
            if (ex) this.b.line(`exposes { ${this.listOf(ex).join(' ')} }`, ex.line);
            const rq = this.take(parts, 'requires', 'requires spi', 'spi');
            if (rq) this.b.line(`requires { ${this.listOf(rq).join(' ')} }`, rq.line);
            const dp = this.take(parts, 'depends on', 'dependencies', 'depends');
            if (dp) this.b.line(`depends on { ${this.listOf(dp).join(' ')} }`, dp.line);
        }
        this.reportUnmapped(parts, `in ${kind} ${name}`);
        this.emitChildren(section, undefined);
        this.b.close(line);
        this.b.blank();
    }

    private rawList(l: Parts['labels'][number] | undefined): string[] {
        if (!l) return [];
        if (l.list) return l.list;
        return l.value ? l.value.split(/\s*(?:;|·)\s*/).filter(Boolean) : [];
    }

    private emitDefinition(section: Section, kind: string, rest: string, defaulted: boolean): void {
        // Sub-headings that are definitions themselves are siblings; the others belong to this definition.
        const own: Section[] = [];
        const siblings: Section[] = [];
        for (const c of section.children) {
            (matchHeading(c.heading!.text, ALL_KINDS) || groupKind(c.heading!.text, DEFINITION_KINDS) ? siblings : own).push(c);
        }
        const blocks = [...section.blocks, ...own.flatMap(flattenBlocks)];
        const parts = collectParts(blocks);
        const line = section.heading!.line;

        // name and head suffix
        let name = unquoteCode(rest);
        let suffix = '';
        if (kind === 'enum') {
            const m = /^(\S+)\s+of\s+(\S+)/i.exec(name);
            if (m) {
                name = m[1];
                suffix = ` of ${m[2]}`;
            }
        } else if (kind === 'repository' || kind === 'read-only repository') {
            const m = /^(\S+)\s+for\s+(\S+)/i.exec(name);
            if (m) {
                name = m[1];
                suffix = ` for ${m[2]}`;
            }
        }
        name = name.split(/\s+/)[0];
        if (kind === 'enum' && !suffix) {
            const of = this.take(parts, 'of', 'value type', 'values of');
            if (of) suffix = ` of ${unquoteCode(of.value)}`;
        }
        if ((kind === 'repository' || kind === 'read-only repository') && !suffix) {
            const f = this.take(parts, 'for', 'entity', 'aggregate');
            if (f) suffix = ` for ${unquoteCode(f.value)}`;
            else this.b.error(line, `repository ${name} names no entity (write "repository ${name} for Entity" or a **For:** line)`, 'MD-REPOSITORY');
        }
        let keyword = kind;
        if (kind === 'repository') {
            const ro = this.take(parts, 'read only', 'readonly');
            if (ro && parseFlag(ro.value) !== false) keyword = 'read-only repository';
        }
        if (kind === 'interface') {
            const role = this.take(parts, 'role');
            const r = role ? stripInline(role.value).toLowerCase() : '';
            if (r === 'api' || r === 'spi') keyword = `${r} interface`;
            else {
                keyword = 'api interface';
                this.b.warn(line, `interface ${name} states no role (api or spi); assuming api`, 'MD-INTERFACE-ROLE');
            }
        }
        if (defaulted) this.b.warn(line, `"${section.heading!.text}" read as ${kind} ${name} (from the group heading above it)`, 'MD-DEFAULT-KIND');

        this.b.open(this.headText(keyword, name, parts, suffix), line);
        this.satisfies(parts);
        const k = keyword.replace(/^read-only repository$/, 'repository').replace(/ interface$/, '-interface');
        switch (k) {
            case 'enum':
                this.enumValues(parts, line);
                break;
            case 'value':
                this.fields(parts, line, true);
                this.islands(parts, ['operations', 'invariants']);
                break;
            case 'entity':
            case 'aggregate':
                this.identity(parts);
                this.exprLabel(parts, 'duplicate detection', e => `duplicate detection { ${e} }`, 'duplicates', 'duplicate');
                this.fields(parts, line, true);
                if (k === 'aggregate') {
                    const ents = this.take(parts, 'entities', 'children', 'child entities');
                    this.b.line(`entities { ${this.listOf(ents).join(' ')} }`, ents?.line ?? line);
                }
                this.references(parts);
                this.islands(parts, ['operations', 'states', 'invariants']);
                break;
            case 'read-only entity': {
                const src = this.take(parts, 'sourced from', 'source', 'owner', 'owned by');
                if (src) this.b.line(`sourced-from ${nameToken(src.value)}`, src.line);
                else this.b.error(line, `read-only entity ${name} needs a **Sourced from:** line`, 'MD-SOURCED-FROM');
                const sync = this.take(parts, 'synced via', 'sync');
                if (sync) this.b.line(`synced-via ${stripInline(sync.value)}`, sync.line);
                const proj = this.take(parts, 'projected by', 'projection', 'adapter');
                if (proj) this.b.line(`projected-by ${unquoteCode(proj.value)}`, proj.line);
                this.identity(parts);
                this.fields(parts, line, true);
                this.references(parts);
                this.islands(parts, ['operations', 'invariants']);
                break;
            }
            case 'command':
                this.identity(parts);
                this.fields(parts, line, true);
                break;
            case 'query': {
                const rf = this.take(parts, 'reads from', 'repository', 'reads');
                if (rf) this.b.line(`reads-from ${unquoteCode(rf.value)}`, rf.line);
                else this.b.error(line, `query ${name} needs a **Reads from:** line`, 'MD-READS-FROM');
                this.fields(parts, line, true);
                const ret = this.take(parts, 'returns', 'return type', 'result');
                if (ret) this.b.line(`returns ${unquoteCode(ret.value)}`, ret.line);
                else this.b.error(line, `query ${name} needs a **Returns:** line`, 'MD-RETURNS');
                break;
            }
            case 'event':
            case 'error event':
                this.simple(parts, 'about', 'about', 'entity', 'subject');
                this.simple(parts, 'caused-by', 'caused by', 'cause', 'trigger');
                this.fields(parts, line, true);
                break;
            case 'external event': {
                const from = this.take(parts, 'from', 'source', 'source context', 'origin');
                if (from) this.b.line(`from ${nameToken(from.value)}`, from.line);
                else this.b.error(line, `external event ${name} needs a **From:** line`, 'MD-FROM');
                this.simple(parts, 'about', 'about', 'entity', 'subject');
                this.fields(parts, line, true);
                break;
            }
            case 'temporal event': {
                this.simple(parts, 'about', 'about', 'entity', 'subject');
                const anchor = this.take(parts, 'anchor', 'when', 'schedule', 'reference', 'instant');
                if (anchor) {
                    const v = unquoteCode(anchor.value);
                    if (anchor.label === 'schedule' && !/^schedule\b/.test(v)) this.b.line(`schedule ${quote(v.replace(/^"|"$/g, ''))}`, anchor.line);
                    else if (anchor.label === 'instant' && !/^instant\b/.test(v)) this.b.line(`instant ${v}`, anchor.line);
                    else this.b.line(v, anchor.line);
                } else this.b.error(line, `temporal event ${name} needs an **Anchor:** line (reference … offset …, instant …, or schedule "…")`, 'MD-ANCHOR');
                this.exprLabel(parts, 'guard', e => `guard { ${e} }`);
                this.fields(parts, line, true);
                break;
            }
            case 'domain service': {
                const calls = this.take(parts, 'calls', 'uses');
                if (calls) this.b.line(`calls { ${this.listOf(calls).join(' ')} }`, calls.line);
                this.islands(parts, ['operations'], 'operations');
                break;
            }
            case 'application service':
                this.simple(parts, 'exposed-by', 'exposed by', 'interface', 'api');
                this.islands(parts, ['operations'], 'operations');
                break;
            case 'infrastructure service':
                this.simple(parts, 'described-by', 'described by', 'interface', 'spi', 'contract');
                this.islands(parts, ['operations'], 'operations');
                break;
            case 'repository':
                this.simple(parts, 'described-by', 'described by', 'interface', 'spi', 'contract');
                this.islands(parts, []);
                break;
            case 'api-interface':
            case 'spi-interface': {
                const ex = this.take(parts, 'exposes', 'operations exposed', 'selects');
                for (const p of this.listOf(ex)) this.b.line(`exposes ${p}`, ex!.line);
                this.simple(parts, 'describes', 'describes', 'provider', 'fulfilled by');
                this.islands(parts, []);
                break;
            }
            case 'reaction': {
                const tb = this.take(parts, 'triggered by', 'triggers', 'on', 'events', 'when');
                if (tb) this.b.line(`triggered-by ${this.listOf(tb).join(', ')}`, tb.line);
                else this.b.error(line, `reaction ${name} needs a **Triggered by:** line`, 'MD-TRIGGERED-BY');
                this.exprLabel(parts, 'guard', e => `guard { ${e} }`, 'condition', 'if');
                const ef = this.take(parts, 'effects', 'effect', 'command', 'then');
                if (ef) this.b.line(`effects ${unquoteCode(ef.value)}`, ef.line);
                else this.b.error(line, `reaction ${name} needs an **Effects:** line`, 'MD-EFFECTS');
                break;
            }
            case 'invariant': {
                const on = this.take(parts, 'on', 'scope', 'applies to');
                if (on) this.b.line(`on ${unquoteCode(on.value)}`, on.line);
                else this.b.error(line, `invariant ${name} needs an **On:** line`, 'MD-ON');
                this.exprLabel(parts, 'must', e => `must { ${e} }`, 'rule', 'condition', 'predicate');
                const en = this.take(parts, 'enforcement', 'enforced by', 'strategy');
                this.b.line(`enforcement ${en ? stripInline(en.value) : 'rejection'}`, en?.line ?? line);
                if (!en) this.b.warn(line, `invariant ${name} states no enforcement; assuming rejection`, 'MD-ENFORCEMENT');
                break;
            }
            case 'agreement': {
                const p = this.take(parts, 'participants', 'between', 'parties');
                if (p) this.b.line(`participants { ${this.listOf(p).join(', ')} }`, p.line);
                else this.b.error(line, `agreement ${name} needs a **Participants:** line`, 'MD-PARTICIPANTS');
                this.exprLabel(parts, 'predicate', e => `predicate { ${e} }`, 'rule', 'must', 'condition');
                this.islands(parts, ['reconciliation']);
                break;
            }
            default:
                this.b.error(line, `no Markdown mapping for kind "${kind}"`, 'MD-KIND');
        }
        this.reportUnmapped(parts, `in ${kind} ${name}`);
        this.b.close(line);
        this.b.blank();
        // Definitions nested under this heading are read as siblings.
        if (siblings.length) this.emitChildren({ blocks: [], children: siblings }, undefined);
    }

    private simple(parts: Parts, keyword: string, ...labels: string[]): void {
        const l = this.take(parts, ...labels);
        if (l) this.b.line(`${keyword} ${unquoteCode(l.value)}`, l.line);
    }

    private exprLabel(parts: Parts, label: string, wrap: (expr: string) => string, ...aliases: string[]): void {
        const l = this.take(parts, label, ...aliases);
        if (l) this.b.line(wrap(unquoteCode(l.value)), l.line);
    }

    private identity(parts: Parts): void {
        const id = this.take(parts, 'identity', 'id', 'identifier', 'key');
        if (id) {
            const v = unquoteCode(id.value).replace(/^identity\s+/, '');
            this.b.line(`identity ${v.includes(':') ? v : `${v} : uuid`}`, id.line);
            if (!v.includes(':')) this.b.warn(id.line, `identity "${v}" names no type; assuming uuid`, 'MD-IDENTITY-TYPE');
        }
    }

    private fields(parts: Parts, line: number, required: boolean): void {
        const i = parts.tables.findIndex(t => columnOf(t, 'field', 'name', 'attribute', 'property') !== -1 && columnOf(t, 'type') !== -1);
        if (i === -1) {
            if (required) this.b.line('fields { }', line);
            return;
        }
        const table = parts.tables.splice(i, 1)[0];
        this.b.open('fields', table.line);
        table.rows.forEach((row, n) => {
            const rec = rowRecord(table, row);
            const fname = cell(rec, 'field', 'name', 'attribute', 'property');
            if (!fname) return;
            let type = cell(rec, 'type') || 'string';
            let optional = false;
            if (type.endsWith('?')) {
                type = type.slice(0, -1).trim();
                optional = true;
            }
            const opt = cell(rec, 'optional', 'nullable');
            if (opt && parseFlag(opt)) optional = true;
            const req = cell(rec, 'required', 'mandatory');
            if (req && parseFlag(req) === false) optional = true;
            const constraints = stripInline(cell(rec, 'constraints', 'constraint', 'rules'));
            const description = stripInline(cell(rec, 'description', 'meaning', 'notes', 'comment'));
            const sat = splitList(cell(rec, 'satisfies', 'requirements', 'req'));
            const parts2 = [`${fname} : ${type}${optional ? '?' : ''}`];
            if (constraints) parts2.push(constraints);
            let text = parts2.join(' ');
            if (description) text += ` :: ${quote(description)}`;
            if (sat.length) text += ` satisfies [${sat.join(', ')}]`;
            this.b.line(text, table.line + 2 + n);
        });
        this.b.close(table.line);
    }

    private references(parts: Parts): void {
        const refs = this.take(parts, 'references', 'refs', 'relations', 'associations');
        const items = this.rawList(refs);
        if (!items.length) return;
        this.b.open('references', refs!.line);
        for (const item of items) {
            const { head, tail } = splitDash(item);
            const h = unquoteCode(stripInline(head));
            const m = /^(\S+)\s*:\s*(\S+)\s+(\d+\.\.(?:\d+|[nN*]))\s*$/.exec(h);
            if (m) this.b.line(`${m[1]} : ${m[2]} ${m[3].replace('*', 'n')}${tail ? ` :: ${quote(stripInline(tail))}` : ''}`, refs!.line);
            else this.b.unmapped({ line: refs!.line }, `reference "${item}"`, 'expected "name : Target 1..n — description"');
        }
        this.b.close(refs!.line);
    }

    private enumValues(parts: Parts, line: number): void {
        const fromLabel = this.take(parts, 'values', 'members', 'literals');
        const bare = parts.lists.shift();
        const items = fromLabel ? this.rawList(fromLabel) : bare?.items ?? [];
        const at = fromLabel?.line ?? bare?.line ?? line;
        if (!items.length) {
            // A table with a value/name column also works.
            const i = parts.tables.findIndex(t => columnOf(t, 'value', 'name', 'member') !== -1);
            if (i !== -1) {
                const t = parts.tables.splice(i, 1)[0];
                for (const row of t.rows) {
                    const rec = rowRecord(t, row);
                    const n = cell(rec, 'name', 'member', 'value');
                    const v = cell(rec, 'code', 'literal', 'number');
                    const d = stripInline(cell(rec, 'description', 'meaning'));
                    if (n) this.b.line(`${n}${v ? ` = ${literalToken(v)}` : ''}${d ? ` :: ${quote(d)}` : ''}`, t.line);
                }
                return;
            }
            this.b.error(line, 'an enum needs a list of values', 'MD-ENUM-VALUES');
            return;
        }
        for (const item of items) {
            const { head, tail } = splitDash(item);
            const h = unquoteCode(stripInline(head));
            const m = /^([A-Za-z_][\w]*)\s*(?:=\s*(.+))?$/.exec(h);
            if (m) this.b.line(`${m[1]}${m[2] !== undefined ? ` = ${literalToken(m[2].trim())}` : ''}${tail ? ` :: ${quote(stripInline(tail))}` : ''}`, at);
            else this.b.unmapped({ line: at }, `enum value "${item}"`, 'expected "name [= value] — description"');
        }
    }

    /** Fenced islands, in the order the grammar wants the blocks they open. */
    private islands(parts: Parts, order: string[], wrapBareIn?: string): void {
        const rankOf = (text: string): number => {
            const first = /^\s*([a-z-]+)/.exec(text)?.[1] ?? '';
            const i = order.indexOf(first);
            return i === -1 ? order.length : i;
        };
        const islands = parts.islands.splice(0, parts.islands.length).sort((a, b) => rankOf(a.text) - rankOf(b.text));
        for (const island of islands) {
            if (island.lang && !/^(specy|domain|dsl|text|)$/i.test(island.lang)) {
                this.b.unmapped({ line: island.line }, `code block (${island.lang})`, 'only specy islands are read');
                continue;
            }
            const first = /^\s*([a-z-]+)/.exec(island.text)?.[1] ?? '';
            if (wrapBareIn && first !== wrapBareIn && !order.includes(first)) {
                this.b.open(wrapBareIn, island.line);
                this.b.raw(island.text, island.line + 1);
                this.b.close(island.line);
            } else {
                this.b.raw(island.text, island.line + 1);
            }
        }
    }
}

function nameToken(v: string): string {
    const s = unquoteCode(stripInline(v));
    return /^[A-Z][a-zA-Z0-9]*$/.test(s) ? s : quote(s);
}

function literalToken(v: string): string {
    const s = unquoteCode(v);
    if (/^-?\d+(\.\d+)?$/.test(s) || s === 'true' || s === 'false') return s;
    return quote(s.replace(/^"|"$/g, ''));
}

export function domainFromMarkdown(markdown: string): ReturnType<DslBuilder['result']> {
    const { root, blocks } = sectionsOf(markdown);
    const fm = blocks.find(b => b.type === 'frontmatter');
    const header = fm && fm.type === 'frontmatter' ? parseFrontMatter(fm.text) : {};
    const reader = new DomainReader(header);
    reader.read(root);
    return reader.b.result(header);
}

/** The field line helper, re-exported for tests of the conventions. */
export { fieldLine, referenceLine };
