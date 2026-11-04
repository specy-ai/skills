/**
 * The Markdown encoding of a software-architecture model — writer and reader.
 *
 * Writer (document -> Markdown): the canonical document of
 * src/metamodels/MODEL-FORMATS.md, "Software architecture". Headings carry the
 * kind and the name (`# architecture Sniplink` > `## system Sniplink` >
 * `### container EdgeApi` > `#### component LinkController`; `# organization
 * RetailMediaCo` > `## system ERP` / `## dependency ERP -> CRM` > `### flow 1
 * "Ad products"`); the first paragraph under a heading is its `::` description;
 * `**Label:** value` lines are the simple clauses; pipe tables are the fields of
 * a struct, exception, union or enum; labelled lists are the name lists
 * (persons, areas, phases, bounded contexts, imports, publishes, flow phases);
 * the connectors of a system sit under a `### Connectors` heading as a list;
 * fenced `specy` islands hold what the DSL says better — the operations of an
 * interface and the body of an environment.
 *
 * Reader (Markdown -> DSL): tolerant of the spellings an author or a language
 * model uses (`Container: EdgeApi`, a bare `EdgeApi` under a `### Containers`
 * group heading, `- Technology: …` lists, `## ERP → CRM` under `## Dependencies`,
 * a struct typed as a table or as an island), it transpiles what it recognizes
 * to DSL and reports the rest as unmapped, line by line.
 */
import type { Block } from '../kit/markdown-blocks.js';
import { metaPairs, parseMetaPairs, quote, isTypeName } from '../kit/dsl.js';
import { MarkdownWriter, code } from '../kit/markdown-writer.js';
import {
    DslBuilder,
    cell,
    columnOf,
    describeBlock,
    flattenBlocks,
    groupKind,
    matchHeading,
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
import type {
    ArchitectureDocument,
    ArchitectureModel,
    ComponentModel,
    ContainerModel,
    DependencyModel,
    Described,
    ExternalSystemModel,
    FlowModel,
    HotspotModel,
    InterfaceModel,
    OrgSystemModel,
    OrganizationModel,
    RealizesRef,
    SystemMembers,
    SystemModel,
    TypeModel,
} from './model.js';
import { connectorLine, environmentIsland, mechanismText, operationsIsland, realizesText } from './printer.js';

// ---------------------------------------------------------------------------
// Kinds — one table drives the writer's headings and the reader's matching
// ---------------------------------------------------------------------------

export const ROOT_KINDS: KindSpec[] = [{ kind: 'architecture' }, { kind: 'organization', words: ['organisation', 'landscape'] }];

export const LEVEL_KINDS: KindSpec[] = [
    { kind: 'external system', words: ['externalSystem', 'external'], group: ['external systems'] },
    { kind: 'system', group: ['systems'] },
    { kind: 'person', words: ['actor', 'user'], group: ['persons', 'people', 'actors', 'users'] },
    { kind: 'area', group: ['areas'] },
    { kind: 'phase', group: ['phases'] },
    { kind: 'dependency', words: ['depends on'], group: ['dependencies'] },
    { kind: 'bounded context', words: ['boundedContext'], group: ['bounded contexts'] },
    { kind: 'hotspot', group: ['hotspots'] },
    { kind: 'flow', group: ['flows'] },
    { kind: 'struct', words: ['dto', 'record'], group: ['structs', 'types', 'dtos'] },
    { kind: 'exception', words: ['error'], group: ['exceptions', 'errors'] },
    { kind: 'union', group: ['unions'] },
    { kind: 'enum', words: ['enumeration'], group: ['enums', 'enumerations'] },
    { kind: 'typedef', words: ['alias', 'type alias'], group: ['typedefs', 'aliases'] },
    { kind: 'import', group: ['imports'] },
    { kind: 'interface', words: ['contract', 'api'], group: ['interfaces', 'contracts', 'apis'] },
    { kind: 'container', group: ['containers'] },
    { kind: 'component', group: ['components'] },
    { kind: 'channel', words: ['topic', 'queue'], group: ['channels', 'topics', 'queues'] },
    { kind: 'environment', words: ['env'], group: ['environments', 'deployment', 'deployments'] },
    { kind: 'connectors', words: ['connector', 'connections', 'wiring'] },
];

const ALL_KINDS = [...ROOT_KINDS, ...LEVEL_KINDS];

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

export function architectureToMarkdown(doc: ArchitectureDocument): string {
    const w = new MarkdownWriter();
    w.frontMatter({ specy: 'architecture' });
    if (doc.architecture) writeArchitecture(w, doc.architecture);
    if (doc.organization) writeOrganization(w, doc.organization);
    return w.toString();
}

function writeCommon(w: MarkdownWriter, c: { description?: string; metadata?: Record<string, unknown>; satisfies?: string[]; realizes?: RealizesRef[] }): void {
    w.para(c.description);
    w.label('Metadata', metaPairs(c.metadata));
    w.labelInline('Satisfies', c.satisfies);
    w.label('Realizes', realizesText(c.realizes).replace(/^ realizes /, ''));
}

function describedItem(d: Described): string {
    return `${d.name}${d.description ? ` — ${d.description}` : ''}${d.metadata && Object.keys(d.metadata).length ? ` · meta: ${metaPairs(d.metadata)}` : ''}`;
}

function writeArchitecture(w: MarkdownWriter, a: ArchitectureModel): void {
    w.heading(1, `architecture ${a.name}`);
    writeCommon(w, a);
    w.labelInline('Domain sources', a.domainSources);
    w.label('Requirements source', a.requirementsSource);
    w.labelList('Persons', a.persons?.map(describedItem));
    for (const e of a.externalSystems ?? []) writeExternalSystem(w, e, 2);
    if (a.system) {
        w.heading(2, `system ${a.system.name}`);
        writeCommon(w, a.system);
        writeMembers(w, a.system, 3);
    }
}

function writeExternalSystem(w: MarkdownWriter, e: ExternalSystemModel, level: number): void {
    w.heading(level, `external system ${e.name}`);
    writeCommon(w, e);
    w.labelInline('Provides', e.provides);
    w.labelInline('Consumes', e.consumes);
    w.labelInline('Masters', e.masters);
}

function writeMembers(w: MarkdownWriter, m: SystemMembers, level: number): void {
    w.labelList('Bounded contexts', m.boundedContexts?.map(describedItem));
    const imports = (m.types ?? []).filter(t => t.kind === 'import') as Extract<TypeModel, { kind: 'import' }>[];
    w.labelList('Imports', imports.map(t => `${t.imports} ${t.name}`));
    for (const t of m.types ?? []) if (t.kind !== 'import') writeType(w, t, level);
    for (const i of m.interfaces ?? []) writeInterface(w, i, level);
    for (const c of m.containers ?? []) writeContainer(w, c, level);
    for (const c of m.channels ?? []) {
        w.heading(level, `channel ${c.name} on ${c.broker}`);
        writeCommon(w, c);
        w.labelInline('Carries', c.carries);
    }
    if (m.connectors?.length) {
        w.heading(level, 'Connectors');
        w.list(m.connectors.map(c => `${code(connectorLine(c).replace(/^connect /, '').replace(/ ::.*$/, '').replace(/ meta \{.*\}$/, ''))}${c.description ? ` — ${c.description}` : ''}${c.metadata && Object.keys(c.metadata).length ? ` · meta: ${metaPairs(c.metadata)}` : ''}`));
    }
    for (const e of m.environments ?? []) {
        w.heading(level, `environment ${e.name}`);
        writeCommon(w, e);
        w.code(environmentIsland(e));
    }
}

const FIELD_HEADER = ['#', 'requiredness', 'type', 'field', 'default', 'description'];

function writeType(w: MarkdownWriter, t: TypeModel, level: number): void {
    switch (t.kind) {
        case 'struct':
        case 'exception':
            w.heading(level, `${t.kind} ${t.name}`);
            writeCommon(w, t.kind === 'struct' ? t : { description: t.description, metadata: t.metadata });
            w.table(
                FIELD_HEADER,
                t.fields.map(f => [f.ordinal, f.requiredness, code(f.type), f.name, f.default !== undefined ? code(JSON.stringify(f.default)) : '', f.description ?? '']),
            );
            return;
        case 'union':
            w.heading(level, `union ${t.name}`);
            writeCommon(w, t);
            w.table(['#', 'type', 'member'], t.members.map(m => [m.ordinal, code(m.type), m.name]));
            return;
        case 'enum':
            w.heading(level, `enum ${t.name}`);
            writeCommon(w, t);
            w.table(['member', 'value'], t.members.map(m => [m.name, m.value]));
            return;
        case 'typedef':
            w.heading(level, `typedef ${t.name}`);
            w.label('Type', code(t.type));
            return;
        case 'import':
            return;
    }
}

function writeInterface(w: MarkdownWriter, i: InterfaceModel, level: number): void {
    w.heading(level, `interface ${i.name}`);
    writeCommon(w, i);
    w.code(operationsIsland(i.operations));
}

function writeContainer(w: MarkdownWriter, c: ContainerModel, level: number): void {
    w.heading(level, `container ${c.name}`);
    w.para(c.description);
    w.label('Metadata', metaPairs(c.metadata));
    w.label('Technology', c.technology);
    w.labelInline('Satisfies', c.satisfies);
    w.label('Realizes', realizesText(c.realizes).replace(/^ realizes /, ''));
    w.labelInline('Provides', c.provides);
    w.labelInline('Requires', c.requires);
    for (const comp of c.components ?? []) writeComponent(w, comp, level + 1);
}

function writeComponent(w: MarkdownWriter, c: ComponentModel, level: number): void {
    w.heading(level, `component ${c.name}`);
    writeCommon(w, c);
    w.label('Bounded context', c.boundedContext);
    w.labelInline('Provides', c.provides);
    w.labelInline('Requires', c.requires);
    w.labelList('Publishes', c.publishes?.map(p => `${p.message} to ${p.channel}`));
    w.labelInline('Subscribes', c.subscribes);
}

function writeOrganization(w: MarkdownWriter, o: OrganizationModel): void {
    w.heading(1, `organization ${o.name}`);
    writeCommon(w, o);
    w.labelInline('Domain sources', o.domainSources);
    w.label('Requirements source', o.requirementsSource);
    w.labelList('Phases', o.phases?.map(describedItem));
    w.labelList('Areas', o.areas?.map(describedItem));
    w.labelList('Persons', o.persons?.map(describedItem));
    for (const e of o.externalSystems ?? []) writeExternalSystem(w, e, 2);
    for (const s of o.systems ?? []) writeOrgSystem(w, s);
    for (const d of o.dependencies ?? []) writeDependency(w, d);
}

function writeOrgSystem(w: MarkdownWriter, s: OrgSystemModel): void {
    w.heading(2, `system ${s.name}`);
    w.para(s.description);
    w.label('Metadata', metaPairs(s.metadata));
    w.label('Technology', s.technology);
    w.labelInline('Satisfies', s.satisfies);
    w.label('Realizes', realizesText(s.realizes).replace(/^ realizes /, ''));
    w.label('Area', s.area);
    w.labelInline('Used by', s.usedBy);
    w.labelInline('Masters', s.masters);
    w.labelInline('Handles', s.handles);
    w.label('Detailed in', s.detailedIn);
    for (const h of s.hotspots ?? []) writeHotspot(w, h, 3);
    if (s.detail) writeMembers(w, s.detail, 3);
}

function writeHotspot(w: MarkdownWriter, h: HotspotModel, level: number): void {
    w.heading(level, `hotspot ${h.name}`);
    w.para(h.description);
    w.label('Metadata', metaPairs(h.metadata));
    w.labelInline('Concerns', h.concerns?.map(String));
}

function writeDependency(w: MarkdownWriter, d: DependencyModel): void {
    w.heading(2, `dependency ${d.downstream} -> ${d.upstream}`);
    w.para(d.description);
    w.label('Metadata', metaPairs(d.metadata));
    w.labelInline('Patterns', d.patterns);
    w.label('Criticality', d.criticality);
    for (const f of d.flows ?? []) writeFlow(w, f, 3);
}

function writeFlow(w: MarkdownWriter, f: FlowModel, level: number): void {
    w.heading(level, `flow ${f.number} ${quote(f.label)}`);
    w.para(f.description);
    w.label('Metadata', metaPairs(f.metadata));
    w.labelInline('Carries', f.carries.map(c => `${c.concept}${c.as ? ` as ${c.as}` : ''}`));
    w.label('To', f.to);
    w.label('Mechanism', f.mechanism ? code(mechanismText(f.mechanism).trim()) : undefined);
    w.labelList('Phases', f.phases?.map(p => `${p.phase}${mechanismText(p)}`));
}

// ---------------------------------------------------------------------------
// Reader
// ---------------------------------------------------------------------------

interface LabelPart {
    label: string;
    value: string;
    line: number;
    list?: string[];
}

interface Parts {
    description?: string;
    descriptionLine?: number;
    labels: LabelPart[];
    tables: { header: string[]; rows: string[][]; line: number }[];
    lists: { items: string[]; line: number }[];
    islands: { text: string; line: number; lang: string }[];
    unmapped: Block[];
}

/** Sort a section's own blocks into the slots a declaration is written from. */
function collectParts(blocks: Block[]): Parts {
    const parts: Parts = { labels: [], tables: [], lists: [], islands: [], unmapped: [] };
    let pendingLabel: LabelPart | undefined;
    for (const b of blocks) {
        switch (b.type) {
            case 'paragraph': {
                // "Some text\n**Label:** value" is one Markdown paragraph: the text before the
                // first label is the description (or unmapped), the labels follow.
                const at = b.text.search(/(?:\*\*|__)\s*[^*_][^*_]{0,60}?\s*:?\s*(?:\*\*|__)/);
                if (at > 0 && parseLabels(b.text.slice(at))) {
                    const lead = b.text.slice(0, at).trim();
                    if (lead) {
                        if (parts.description === undefined && !parts.labels.length && !parts.tables.length) {
                            parts.description = stripInline(lead);
                            parts.descriptionLine = b.line;
                        } else parts.unmapped.push({ ...b, text: lead });
                    }
                    for (const l of parseLabels(b.text.slice(at))!) parts.labels.push({ ...l, line: b.line });
                    const last = parts.labels[parts.labels.length - 1];
                    pendingLabel = last.value === '' ? last : undefined;
                    break;
                }
                const labels = parseLabels(b.text);
                if (labels) {
                    for (const l of labels) parts.labels.push({ ...l, line: b.line });
                    pendingLabel = labels[labels.length - 1].value === '' ? parts.labels[parts.labels.length - 1] : undefined;
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
                } else if (b.items.every(i => itemLabel(i))) {
                    for (const i of b.items) {
                        const l = itemLabel(i)!;
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
            default:
                break;
        }
    }
    return parts;
}

/** `- Label: value`, or `- Label:` whose value is the nested list under it. */
function itemLabel(item: { text: string; children: unknown[] }): { label: string; value: string } | undefined {
    const l = parseItemLabel(item.text);
    if (l) return l;
    const m = /^(?:\*\*|__)?([A-Za-z][A-Za-z0-9 _-]{0,40}?)(?:\*\*|__)?\s*:\s*$/.exec(stripInline(item.text));
    return m && item.children.length ? { label: m[1].toLowerCase().replace(/[\s_-]+/g, ' ').trim(), value: '' } : undefined;
}

/** `· meta: k = v` at the end of a list item. */
function splitMeta(item: string): { body: string; meta: string } {
    const [body, metaText] = item.split(/\s*·\s*meta(?:data)?\s*:\s*/i);
    if (!metaText) return { body: item, meta: '' };
    const pairs = parseMetaPairs(metaText);
    return { body, meta: pairs.length ? ` meta { ${pairs.map(([k, v]) => `${k} = ${v}`).join(' ')} }` : '' };
}

/** `realizes` refs as written: `module "Link Shortening", context Sales, value type Money`. */
function realizesClause(value: string): string {
    const refs: string[] = [];
    const re = /(module|context|interface|event|value\s+type)\s+("[^"]*"|\S+)/g;
    let m: RegExpExecArray | null;
    const text = unquoteCode(value);
    while ((m = re.exec(text))) refs.push(`${m[1].replace(/\s+/, ' ')} ${m[2].replace(/,$/, '')}`);
    return refs.length ? ` realizes ${refs.join(', ')}` : '';
}

const TYPE_KINDS = ['struct', 'exception', 'union', 'enum', 'typedef', 'import'];

class ArchitectureReader {
    readonly b = new DslBuilder('  ');

    constructor(private readonly header: Record<string, string>) {}

    read(root: Section): void {
        this.reportUnmapped(collectParts(root.blocks), 'before the first heading');
        let roots = 0;
        for (const child of root.children) {
            const m = matchHeading(child.heading!.text, ROOT_KINDS);
            if (m && !m.defaulted) {
                roots++;
                if (m.kind === 'architecture') this.emitArchitecture(child, m.rest);
                else this.emitOrganization(child, m.rest);
            } else {
                this.b.warn(child.heading!.line, `heading "${child.heading!.text}" is not an architecture or organization root; its content is read in place`, 'MD-HEADING');
                this.reportUnmapped(collectParts(child.blocks), `under the heading "${child.heading!.text}"`);
                for (const c of child.children) {
                    const mm = matchHeading(c.heading!.text, ROOT_KINDS);
                    if (mm && !mm.defaulted) {
                        roots++;
                        if (mm.kind === 'architecture') this.emitArchitecture(c, mm.rest);
                        else this.emitOrganization(c, mm.rest);
                    } else {
                        this.b.unmapped({ line: c.heading!.line }, `heading: ${c.heading!.text}`, 'expected an architecture or organization root');
                    }
                }
            }
        }
        if (!roots) this.b.error(1, 'no root: write a `# architecture Name` or `# organization Name` heading', 'MD-ROOT');
    }

    // --- shared helpers ------------------------------------------------------

    private reportUnmapped(parts: Parts, where: string): void {
        for (const u of parts.unmapped) this.b.unmapped(u, describeBlock(u), where);
        for (const l of parts.labels) this.b.unmapped({ line: l.line }, `label "${l.label}"`, where);
        for (const t of parts.tables) this.b.unmapped({ line: t.line }, `table with columns ${t.header.join(', ')}`, where);
        for (const l of parts.lists) this.b.unmapped({ line: l.line }, `list: ${l.items.join(' / ')}`, where);
        for (const i of parts.islands) this.b.unmapped({ line: i.line }, 'code block', where);
        if (parts.description !== undefined) this.b.unmapped({ line: parts.descriptionLine ?? 1 }, parts.description, where);
    }

    private take(parts: Parts, ...labels: string[]): LabelPart | undefined {
        const i = parts.labels.findIndex(l => labels.includes(l.label));
        return i === -1 ? undefined : parts.labels.splice(i, 1)[0];
    }

    private listOf(l: LabelPart | undefined): string[] {
        if (!l) return [];
        if (l.list) return l.list.map(s => unquoteCode(stripInline(s)));
        return splitList(l.value);
    }

    private rawList(l: LabelPart | undefined): string[] {
        if (!l) return [];
        if (l.list) return l.list;
        return l.value ? l.value.split(/\s*(?:;|·)\s*/).filter(Boolean) : [];
    }

    /** `:: "description" meta { … }` from the parts, consuming both. */
    private headTail(parts: Parts): string {
        const meta = this.take(parts, 'metadata', 'meta');
        const pairs = meta ? parseMetaPairs(meta.value) : [];
        const metaText = pairs.length ? ` meta { ${pairs.map(([k, v]) => `${k} = ${v}`).join(' ')} }` : '';
        const description = parts.description;
        parts.description = undefined;
        return `${description ? ` :: ${quote(description)}` : ''}${metaText}`;
    }

    private technology(parts: Parts): string {
        const t = this.take(parts, 'technology', 'tech', 'product', 'stack');
        return t ? ` technology ${quote(stripInline(t.value))}` : '';
    }

    private satisfies(parts: Parts): string {
        const s = this.take(parts, 'satisfies', 'requirements');
        return s ? ` satisfies [${this.listOf(s).join(', ')}]` : '';
    }

    private realizes(parts: Parts): string {
        const r = this.take(parts, 'realizes', 'realises', 'implements');
        if (!r) return '';
        const text = r.list ? r.list.join(', ') : r.value;
        const clause = realizesClause(text);
        if (!clause) this.b.unmapped({ line: r.line }, `realizes "${text}"`, 'expected "module X, context Y, interface Z, event E, value type V"');
        return clause;
    }

    /** `**Label:** a, b` -> one `keyword x` line per name. */
    private each(parts: Parts, keyword: string, ...labels: string[]): void {
        const l = this.take(parts, ...labels);
        for (const name of this.listOf(l)) this.b.line(`${keyword} ${name}`, l!.line);
    }

    /** `**Label:** a, b` -> `keyword a, b`. */
    private joined(parts: Parts, keyword: string, ...labels: string[]): void {
        const l = this.take(parts, ...labels);
        const names = this.listOf(l);
        if (names.length) this.b.line(`${keyword} ${names.join(', ')}`, l!.line);
    }

    private describedList(parts: Parts, keyword: string, ...labels: string[]): void {
        const l = this.take(parts, ...labels);
        for (const item of this.rawList(l)) {
            const { body, meta } = splitMeta(item);
            const { head, tail } = splitDash(body);
            const name = unquoteCode(stripInline(head)).split(/\s+/)[0];
            this.b.line(`${keyword} ${name}${tail ? ` :: ${quote(stripInline(tail))}` : ''}${meta}`, l!.line);
        }
    }

    /**
     * Children partitioned: those naming a kind (or a group, or a bare name
     * when the context gives a default kind) and the rest, which belong to the
     * section itself (an "Overview" sub-heading, its blocks read in place).
     */
    private split(section: Section, defaultKind?: string): { kinds: Section[]; own: Section[] } {
        const kinds: Section[] = [];
        const own: Section[] = [];
        for (const c of section.children) {
            (groupKind(c.heading!.text, ALL_KINDS) || matchHeading(c.heading!.text, ALL_KINDS, defaultKind) ? kinds : own).push(c);
        }
        return { kinds, own };
    }

    private partsOf(section: Section, defaultKind?: string): Parts {
        const { own } = this.split(section, defaultKind);
        return collectParts([...section.blocks, ...own.flatMap(flattenBlocks)]);
    }

    /** Walk the kind-named children, resolving group headings to a default kind. */
    private children(section: Section, defaultKind: string | undefined, visit: (child: Section, kind: string, rest: string, defaulted: boolean) => void): void {
        for (const child of this.split(section, defaultKind).kinds) {
            const text = child.heading!.text;
            // A heading that IS a group word ("External systems") is a group, never a
            // kind with a name: the alias "external" would otherwise read it as the
            // external system named "systems".
            const gk = groupKind(text, LEVEL_KINDS);
            if (gk) {
                this.reportUnmapped(collectParts(child.blocks), `under the group heading "${text}"`);
                this.children(child, gk, visit);
                continue;
            }
            if (normalizeGroup(text) === 'connectors') {
                visit(child, 'connectors', '', false);
                continue;
            }
            const asKind = matchHeading(text, LEVEL_KINDS, defaultKind);
            if (asKind) {
                if (asKind.kind === 'connectors') visit(child, 'connectors', asKind.rest, false);
                else visit(child, asKind.kind, asKind.rest, asKind.defaulted);
                continue;
            }
            this.b.warn(child.heading!.line, `heading "${text}" names no architecture construct; its sub-headings are read in place`, 'MD-HEADING');
            this.reportUnmapped(collectParts(child.blocks), `under the heading "${text}"`);
            this.children(child, defaultKind, visit);
        }
    }

    private nameOf(rest: string, fallbackLine: number, what: string): string {
        const name = unquoteCode(stripInline(rest)).split(/\s+/)[0] ?? '';
        if (!name) this.b.error(fallbackLine, `${what} has no name`, 'MD-NAME');
        return name;
    }

    // --- architecture root ---------------------------------------------------

    private emitArchitecture(section: Section, rest: string): void {
        const parts = this.partsOf(section);
        const line = section.heading!.line;
        const name = unquoteCode(stripInline(rest));
        this.b.open(`architecture ${isTypeName(name) ? name : quote(name)}${this.headTail(parts)}`, line);
        this.sources(parts);
        this.describedList(parts, 'person', 'persons', 'people', 'actors', 'users');
        this.reportUnmapped(parts, `in architecture ${name}`);
        this.children(section, undefined, (child, kind, r, defaulted) => {
            if (defaulted) this.b.warn(child.heading!.line, `"${child.heading!.text}" read as ${kind} (from the group heading above it)`, 'MD-DEFAULT-KIND');
            switch (kind) {
                case 'person':
                    this.emitPerson(child, r);
                    break;
                case 'external system':
                    this.emitExternalSystem(child, r);
                    break;
                case 'system':
                    this.emitSystem(child, r, false);
                    break;
                default:
                    this.b.unmapped({ line: child.heading!.line }, `heading: ${child.heading!.text}`, `a ${kind} does not belong directly to an architecture`);
            }
        });
        this.b.close(line);
        this.b.blank();
    }

    /** `domain-source` paths (several allowed) and the one `requirements-source`. */
    private sources(parts: Parts): void {
        const ds = this.take(parts, 'domain sources', 'domain source', 'domain', 'domains');
        for (const path of this.listOf(ds)) this.b.line(`domain-source ${quote(path)}`, ds!.line);
        const rs = this.take(parts, 'requirements source', 'requirements', 'sysreq');
        if (rs) this.b.line(`requirements-source ${quote(unquoteCode(rs.value))}`, rs.line);
    }

    private emitPerson(section: Section, rest: string): void {
        const parts = this.partsOf(section);
        const line = section.heading!.line;
        this.b.line(`person ${this.nameOf(rest, line, 'person')}${this.headTail(parts)}`, line);
        this.reportUnmapped(parts, 'in person');
    }

    private emitExternalSystem(section: Section, rest: string): void {
        const parts = this.partsOf(section);
        const line = section.heading!.line;
        const name = this.nameOf(rest, line, 'external system');
        const head = `externalSystem ${name}${this.headTail(parts)}${this.realizes(parts)}`;
        const provides = this.listOf(this.take(parts, 'provides', 'provided interfaces'));
        const consumes = this.listOf(this.take(parts, 'consumes', 'consumed interfaces'));
        const masters = this.listOf(this.take(parts, 'masters', 'system of record for', 'source of truth for'));
        if (!provides.length && !consumes.length && !masters.length) {
            this.b.line(head, line);
        } else {
            this.b.open(head, line);
            for (const p of provides) this.b.line(`provides ${p}`, line);
            for (const c of consumes) this.b.line(`consumes ${c}`, line);
            if (masters.length) this.b.line(`masters ${masters.join(', ')}`, line);
            this.b.close(line);
        }
        this.reportUnmapped(parts, `in external system ${name}`);
    }

    // --- systems ---------------------------------------------------------------

    private emitSystem(section: Section, rest: string, level0: boolean): void {
        const parts = this.partsOf(section);
        const line = section.heading!.line;
        const name = unquoteCode(stripInline(rest));
        const headName = isTypeName(name) ? name : quote(name);
        const technology = level0 ? this.technology(parts) : '';
        const head = `system ${headName}${this.headTail(parts)}${technology}${this.satisfies(parts)}${this.realizes(parts)}`;
        const { kinds } = this.split(section);
        const hasMembers = kinds.length > 0 || parts.labels.some(l => ['bounded contexts', 'imports'].includes(l.label));
        const level0Labels = level0 ? ['area', 'used by', 'users', 'masters', 'handles', 'detailed in', 'detailed-in', 'hotspots'] : [];
        const hasLevel0 = parts.labels.some(l => level0Labels.includes(l.label));
        if (!level0 || hasMembers || hasLevel0) this.b.open(head, line);
        else this.b.line(head, line);
        const open = !level0 || hasMembers || hasLevel0;
        if (level0) {
            const area = this.take(parts, 'area');
            if (area) this.b.line(`area ${unquoteCode(area.value)}`, area.line);
            this.joined(parts, 'used-by', 'used by', 'users', 'used-by');
            this.joined(parts, 'masters', 'masters', 'system of record for', 'source of truth for');
            this.joined(parts, 'handles', 'handles', 'holds');
        }
        // Hotspots are level-0 clauses: they come before the members.
        const hotspots = kinds.filter(c => {
            const m = matchHeading(c.heading!.text, LEVEL_KINDS);
            return (m && m.kind === 'hotspot') || groupKind(c.heading!.text, LEVEL_KINDS) === 'hotspot';
        });
        if (level0) {
            this.children({ blocks: [], children: hotspots }, undefined, (child, kind, r) => {
                if (kind === 'hotspot') this.emitHotspot(child, r);
            });
            const di = this.take(parts, 'detailed in', 'detailed-in', 'detail file');
            if (di) this.b.line(`detailed-in ${quote(unquoteCode(di.value))}`, di.line);
        }
        this.emitMembers(section, parts, kinds.filter(c => !hotspots.includes(c)), name);
        if (open) this.b.close(line);
        this.b.blank();
    }

    private emitMembers(section: Section, parts: Parts, members: Section[], systemName: string): void {
        this.describedList(parts, 'boundedContext', 'bounded contexts', 'contexts', 'bounded context');
        const imports = this.take(parts, 'imports', 'imported types', 'from domain');
        for (const item of this.rawList(imports)) {
            const m = /^(value\s+type|event)\s+(\S+)/i.exec(unquoteCode(stripInline(item)).replace(/^import\s+/, ''));
            if (m) this.b.line(`import ${m[1].toLowerCase().replace(/\s+/, ' ')} ${m[2]} from domain`, imports!.line);
            else this.b.unmapped({ line: imports!.line }, `import "${item}"`, 'expected "value type X" or "event X"');
        }
        this.reportUnmapped(parts, `in system ${systemName}`);
        this.children({ blocks: [], children: members }, undefined, (child, kind, rest, defaulted) => {
            if (defaulted) this.b.warn(child.heading!.line, `"${child.heading!.text}" read as ${kind} (from the group heading above it)`, 'MD-DEFAULT-KIND');
            this.b.blank();
            switch (kind) {
                case 'bounded context':
                    this.emitBoundedContext(child, rest);
                    break;
                case 'struct':
                case 'exception':
                case 'union':
                case 'enum':
                case 'typedef':
                case 'import':
                    this.emitType(child, kind, rest);
                    break;
                case 'interface':
                    this.emitInterface(child, rest);
                    break;
                case 'container':
                    this.emitContainer(child, rest);
                    break;
                case 'channel':
                    this.emitChannel(child, rest);
                    break;
                case 'connectors':
                    this.emitConnectors(child);
                    break;
                case 'environment':
                    this.emitEnvironment(child, rest);
                    break;
                case 'component':
                    this.b.error(child.heading!.line, `component ${rest} must sit under a container heading`, 'MD-COMPONENT');
                    break;
                default:
                    this.b.unmapped({ line: child.heading!.line }, `heading: ${child.heading!.text}`, `a ${kind} does not belong to a system`);
            }
        });
    }

    private emitBoundedContext(section: Section, rest: string): void {
        const parts = this.partsOf(section);
        const line = section.heading!.line;
        this.b.line(`boundedContext ${this.nameOf(rest, line, 'bounded context')}${this.headTail(parts)}`, line);
        this.reportUnmapped(parts, 'in bounded context');
    }

    private emitHotspot(section: Section, rest: string): void {
        const parts = this.partsOf(section);
        const line = section.heading!.line;
        const name = this.nameOf(rest, line, 'hotspot');
        if (!parts.description) this.b.error(line, `hotspot ${name} needs a description paragraph`, 'MD-HOTSPOT');
        const concerns = this.listOf(this.take(parts, 'concerns', 'affects', 'flows'));
        this.b.line(`hotspot ${name}${this.headTail(parts) || ' :: ""'}${concerns.length ? ` concerns ${concerns.join(', ')}` : ''}`, line);
        this.reportUnmapped(parts, `in hotspot ${name}`);
    }

    private emitType(section: Section, kind: string, rest: string): void {
        const parts = this.partsOf(section);
        const line = section.heading!.line;
        if (kind === 'import') {
            const m = /^(value\s+type|event)\s+(\S+)/i.exec(unquoteCode(stripInline(rest)));
            if (m) this.b.line(`import ${m[1].toLowerCase().replace(/\s+/, ' ')} ${m[2]} from domain`, line);
            else this.b.error(line, `import "${rest}": expected "value type X" or "event X"`, 'MD-IMPORT');
            this.reportUnmapped(parts, 'in import');
            return;
        }
        if (kind === 'typedef') {
            const m = /^(\S+)\s*=\s*(.+)$/.exec(unquoteCode(stripInline(rest)));
            const name = m ? m[1] : this.nameOf(rest, line, 'typedef');
            const t = m ? m[2].trim() : unquoteCode(this.take(parts, 'type', 'alias of', 'is')?.value ?? '');
            if (!t) this.b.error(line, `typedef ${name} needs a **Type:** line`, 'MD-TYPEDEF');
            this.b.line(`typedef ${name} = ${t}`, line);
            this.reportUnmapped(parts, `in typedef ${name}`);
            return;
        }
        const name = this.nameOf(rest, line, kind);
        const sat = kind === 'struct' ? this.satisfies(parts) : '';
        this.b.open(`${kind} ${name}${this.headTail(parts)}${sat}`, line);
        const island = parts.islands.shift();
        if (island) {
            this.b.raw(island.text, island.line + 1);
        } else if (kind === 'enum') {
            const t = parts.tables.shift();
            if (t) {
                t.rows.forEach((row, i) => {
                    const rec = rowRecord(t, row);
                    const member = cell(rec, 'member', 'name', 'value name', 'literal');
                    const value = cell(rec, 'value', 'code', '#', 'ordinal', 'number') || String(i + 1);
                    if (member) this.b.line(`${member} = ${value}`, t.line + 2 + i);
                });
            } else {
                const l = parts.lists.shift() ?? { items: this.rawList(this.take(parts, 'members', 'values')), line };
                l.items.forEach((item, i) => {
                    const m = /^([A-Za-z_]\w*)\s*(?:=\s*(-?\d+))?/.exec(unquoteCode(stripInline(item)));
                    if (m) this.b.line(`${m[1]} = ${m[2] ?? i + 1}`, l.line);
                    else this.b.unmapped({ line: l.line }, `enum member "${item}"`, 'expected "name = number"');
                });
                if (!l.items.length) this.b.error(line, `enum ${name} needs its members (a table or a list)`, 'MD-ENUM');
            }
        } else {
            const t = parts.tables.shift();
            if (!t) this.b.error(line, `${kind} ${name} needs a fields table or a specy island`, 'MD-FIELDS');
            else if (kind === 'union') {
                t.rows.forEach((row, i) => {
                    const rec = rowRecord(t, row);
                    const ordinal = cell(rec, '#', 'ordinal', 'id') || String(i + 1);
                    const type = cell(rec, 'type');
                    const member = cell(rec, 'member', 'name', 'field');
                    if (member) this.b.line(`${ordinal}: ${type || 'string'} ${member}`, t.line + 2 + i);
                });
            } else {
                t.rows.forEach((row, i) => {
                    const rec = rowRecord(t, row);
                    const ordinal = cell(rec, '#', 'ordinal', 'id') || String(i + 1);
                    const req = (cell(rec, 'requiredness', 'required', 'req') || 'required').toLowerCase();
                    const requiredness = /^(optional|no|false|✗)$/.test(req) ? 'optional' : 'required';
                    const type = cell(rec, 'type') || 'string';
                    const field = cell(rec, 'field', 'name', 'attribute', 'property');
                    const def = cell(rec, 'default');
                    const description = stripInline(cell(rec, 'description', 'meaning', 'notes'));
                    if (!field) return;
                    this.b.line(`${ordinal}: ${requiredness} ${type} ${field}${def ? ` = ${literalToken(def)}` : ''}${description ? ` :: ${quote(description)}` : ''}`, t.line + 2 + i);
                });
            }
        }
        this.b.close(line);
        this.reportUnmapped(parts, `in ${kind} ${name}`);
    }

    private emitInterface(section: Section, rest: string): void {
        const parts = this.partsOf(section);
        const line = section.heading!.line;
        const name = this.nameOf(rest, line, 'interface');
        this.b.open(`interface ${name}${this.headTail(parts)}${this.satisfies(parts)}${this.realizes(parts)}`, line);
        for (const island of parts.islands.splice(0, parts.islands.length)) this.b.raw(island.text, island.line + 1);
        // operations may also be listed, one signature per item
        const ops = this.take(parts, 'operations', 'methods');
        for (const item of this.rawList(ops)) this.b.line(unquoteCode(stripInline(item)), ops!.line);
        for (const l of parts.lists.splice(0, parts.lists.length)) for (const item of l.items) this.b.line(unquoteCode(stripInline(item)), l.line);
        this.b.close(line);
        this.reportUnmapped(parts, `in interface ${name}`);
    }

    private emitContainer(section: Section, rest: string): void {
        const parts = this.partsOf(section, 'component');
        const line = section.heading!.line;
        const name = this.nameOf(rest, line, 'container');
        const head = `container ${name}${this.headTail(parts)}${this.technology(parts)}${this.satisfies(parts)}${this.realizes(parts)}`;
        const provides = this.take(parts, 'provides', 'provided interfaces', 'exposes');
        const requires = this.take(parts, 'requires', 'required interfaces', 'needs');
        const p = this.listOf(provides);
        const r = this.listOf(requires);
        const { kinds } = this.split(section, 'component');
        if (!p.length && !r.length && !kinds.length) {
            this.b.line(head, line);
        } else {
            this.b.open(head, line);
            for (const x of p) this.b.line(`provides ${x}`, provides!.line);
            for (const x of r) this.b.line(`requires ${x}`, requires!.line);
            this.children(section, 'component', (child, kind, rr, defaulted) => {
                if (kind !== 'component') {
                    this.b.unmapped({ line: child.heading!.line }, `heading: ${child.heading!.text}`, `a ${kind} does not belong to a container`);
                    return;
                }
                if (defaulted) this.b.warn(child.heading!.line, `"${child.heading!.text}" read as component`, 'MD-DEFAULT-KIND');
                this.b.blank();
                this.emitComponent(child, rr);
            });
            this.b.close(line);
        }
        this.reportUnmapped(parts, `in container ${name}`);
    }

    private emitComponent(section: Section, rest: string): void {
        const parts = this.partsOf(section);
        const line = section.heading!.line;
        const name = this.nameOf(rest, line, 'component');
        const head = `component ${name}${this.headTail(parts)}${this.satisfies(parts)}${this.realizes(parts)}`;
        const bc = this.take(parts, 'bounded context', 'context');
        const provides = this.take(parts, 'provides', 'provided interfaces', 'exposes');
        const requires = this.take(parts, 'requires', 'required interfaces', 'needs');
        const publishes = this.take(parts, 'publishes', 'emits');
        const subscribes = this.take(parts, 'subscribes', 'subscribes to', 'listens to', 'consumes');
        const p = this.listOf(provides);
        const r = this.listOf(requires);
        const pub = this.rawList(publishes);
        const sub = this.listOf(subscribes);
        if (!bc && !p.length && !r.length && !pub.length && !sub.length) {
            this.b.line(head, line);
        } else {
            this.b.open(head, line);
            if (bc) this.b.line(`boundedContext ${unquoteCode(bc.value)}`, bc.line);
            for (const x of p) this.b.line(`provides ${x}`, provides!.line);
            for (const x of r) this.b.line(`requires ${x}`, requires!.line);
            for (const item of pub) {
                const m = /^(\S+)\s+(?:to|on|->|→)\s+(\S+)$/.exec(unquoteCode(stripInline(item)));
                if (m) this.b.line(`publishes ${m[1]} to ${m[2]}`, publishes!.line);
                else this.b.unmapped({ line: publishes!.line }, `publishes "${item}"`, 'expected "Message to channel"');
            }
            for (const x of sub) this.b.line(`subscribes ${x}`, subscribes!.line);
            this.b.close(line);
        }
        this.reportUnmapped(parts, `in component ${name}`);
    }

    private emitChannel(section: Section, rest: string): void {
        const parts = this.partsOf(section);
        const line = section.heading!.line;
        const m = /^(\S+)\s+on\s+(\S+)/i.exec(unquoteCode(stripInline(rest)));
        const name = m ? m[1] : this.nameOf(rest, line, 'channel');
        let broker = m ? m[2] : '';
        if (!broker) {
            const b = this.take(parts, 'on', 'broker', 'hosted on', 'host');
            if (b) broker = unquoteCode(b.value);
            else this.b.error(line, `channel ${name} names no broker (write "channel ${name} on Broker" or a **Broker:** line)`, 'MD-CHANNEL');
        }
        const carries = this.listOf(this.take(parts, 'carries', 'messages', 'events'));
        if (!carries.length) this.b.error(line, `channel ${name} needs a **Carries:** line`, 'MD-CARRIES');
        this.b.open(`channel ${name} on ${broker || 'Broker'}${this.headTail(parts)}`, line);
        this.b.line(`carries ${carries.join(', ')}`, line);
        this.b.close(line);
        this.reportUnmapped(parts, `in channel ${name}`);
    }

    private emitConnectors(section: Section): void {
        const parts = collectParts(flattenBlocks(section));
        for (const island of parts.islands.splice(0, parts.islands.length)) this.b.raw(island.text, island.line + 1);
        const lists = [...parts.lists.splice(0, parts.lists.length).map(l => ({ items: l.items, line: l.line }))];
        const labelled = this.take(parts, 'connectors', 'connections', 'wiring');
        if (labelled) lists.push({ items: this.rawList(labelled), line: labelled.line });
        for (const l of lists) {
            for (const item of l.items) {
                const { body, meta } = splitMeta(item);
                const { head, tail } = splitDash(body);
                const h = unquoteCode(stripInline(head)).replace(/^connect\s+/, '');
                const m = /^(\S+)\s*(?:->|→|=>)\s*(\S+)\s+over\s+"([^"]*)"\s+(sync|async|streaming)\s*$/.exec(h);
                if (m) this.b.line(`connect ${m[1]} -> ${m[2]} over ${quote(m[3])} ${m[4]}${tail ? ` :: ${quote(stripInline(tail))}` : ''}${meta}`, l.line);
                else this.b.unmapped({ line: l.line }, `connector "${item}"`, 'expected "A -> B over \\"protocol\\" sync|async|streaming — description"');
            }
        }
        parts.description = undefined;
        this.reportUnmapped(parts, 'in connectors');
    }

    private emitEnvironment(section: Section, rest: string): void {
        const parts = this.partsOf(section);
        const line = section.heading!.line;
        const name = this.nameOf(rest, line, 'environment');
        this.b.open(`environment ${name}${this.headTail(parts)}`, line);
        for (const island of parts.islands.splice(0, parts.islands.length)) this.b.raw(island.text, island.line + 1);
        const deploys = this.take(parts, 'deploys', 'deploy', 'runs');
        for (const item of this.rawList(deploys)) this.b.line(`deploy ${unquoteCode(stripInline(item)).replace(/^deploy\s+/, '')}`, deploys!.line);
        this.b.close(line);
        this.reportUnmapped(parts, `in environment ${name}`);
    }

    // --- organization root ------------------------------------------------------

    private emitOrganization(section: Section, rest: string): void {
        const parts = this.partsOf(section);
        const line = section.heading!.line;
        const name = this.nameOf(rest, line, 'organization');
        this.b.open(`organization ${name}${this.headTail(parts)}`, line);
        this.sources(parts);
        this.describedList(parts, 'phase', 'phases', 'roadmap');
        this.describedList(parts, 'area', 'areas', 'domains of the business');
        this.describedList(parts, 'person', 'persons', 'people', 'actors', 'users');
        this.reportUnmapped(parts, `in organization ${name}`);
        this.children(section, undefined, (child, kind, r, defaulted) => {
            if (defaulted) this.b.warn(child.heading!.line, `"${child.heading!.text}" read as ${kind} (from the group heading above it)`, 'MD-DEFAULT-KIND');
            this.b.blank();
            switch (kind) {
                case 'phase':
                case 'area':
                case 'person': {
                    const p = this.partsOf(child);
                    this.b.line(`${kind} ${this.nameOf(r, child.heading!.line, kind)}${this.headTail(p)}`, child.heading!.line);
                    this.reportUnmapped(p, `in ${kind}`);
                    break;
                }
                case 'external system':
                    this.emitExternalSystem(child, r);
                    break;
                case 'system':
                    this.emitSystem(child, r, true);
                    break;
                case 'dependency':
                    this.emitDependency(child, r);
                    break;
                default:
                    this.b.unmapped({ line: child.heading!.line }, `heading: ${child.heading!.text}`, `a ${kind} does not belong directly to an organization`);
            }
        });
        this.b.close(line);
        this.b.blank();
    }

    private emitDependency(section: Section, rest: string): void {
        const parts = this.partsOf(section, 'flow');
        const line = section.heading!.line;
        const m = /^(\S+)\s*(?:->|→|=>|depends\s+on)\s*(\S+)\s*$/i.exec(unquoteCode(stripInline(rest)));
        if (!m) {
            this.b.error(line, `dependency "${rest}": expected "Downstream -> Upstream"`, 'MD-DEPENDENCY');
            return;
        }
        const patterns = this.listOf(this.take(parts, 'patterns', 'pattern', 'context map', 'relationship'));
        const crit = this.take(parts, 'criticality', 'when upstream is down');
        const head =
            `dependency ${m[1]} -> ${m[2]}` +
            (patterns.length ? ` : ${patterns.join(', ')}` : '') +
            (crit ? ` criticality ${stripInline(crit.value).toLowerCase()}` : '') +
            this.headTail(parts);
        const { kinds } = this.split(section, 'flow');
        const flowsLabel = this.take(parts, 'flows');
        if (!kinds.length && !parts.islands.length && !flowsLabel) {
            this.b.line(head, line);
        } else {
            this.b.open(head, line);
            for (const island of parts.islands.splice(0, parts.islands.length)) this.b.raw(island.text, island.line + 1);
            for (const item of this.rawList(flowsLabel)) this.b.line(unquoteCode(stripInline(item)).replace(/^(?!flow\s)/, 'flow '), flowsLabel!.line);
            this.children(section, 'flow', (child, kind, r, defaulted) => {
                if (kind !== 'flow') {
                    this.b.unmapped({ line: child.heading!.line }, `heading: ${child.heading!.text}`, `a ${kind} does not belong to a dependency`);
                    return;
                }
                if (defaulted) this.b.warn(child.heading!.line, `"${child.heading!.text}" read as flow`, 'MD-DEFAULT-KIND');
                this.emitFlow(child, r);
            });
            this.b.close(line);
        }
        this.reportUnmapped(parts, `in dependency ${m[1]} -> ${m[2]}`);
    }

    private emitFlow(section: Section, rest: string): void {
        const parts = this.partsOf(section);
        const line = section.heading!.line;
        const m = /^(\d+)\s*[:—–-]?\s*"?(.*?)"?\s*$/.exec(stripInline(rest));
        if (!m) {
            this.b.error(line, `flow "${rest}": expected "flow <number> \\"label\\""`, 'MD-FLOW');
            return;
        }
        const carries = this.listOf(this.take(parts, 'carries', 'concepts', 'data'));
        if (!carries.length) this.b.error(line, `flow ${m[1]} needs a **Carries:** line`, 'MD-CARRIES');
        const to = this.take(parts, 'to', 'receiver', 'towards');
        const mech = this.take(parts, 'mechanism', 'how', 'medium', 'over');
        const phases = this.take(parts, 'phases', 'per phase', 'by phase');
        let head = `flow ${m[1]} ${quote(m[2])}${this.headTail(parts)} carries ${carries.join(', ')}`;
        if (to) head += ` to ${unquoteCode(to.value)}`;
        const phaseItems = this.rawList(phases);
        if (phaseItems.length) {
            this.b.open(head, line);
            for (const item of phaseItems) {
                const text = unquoteCode(stripInline(item)).replace(/^phase\s+/i, '');
                const pm = /^(\S+)\s*[:—–-]?\s*(.*)$/.exec(text);
                if (pm) this.b.line(`phase ${pm[1]}${mechanismClause(pm[2])}`, phases!.line);
            }
            this.b.close(line);
        } else {
            this.b.line(head + (mech ? mechanismClause(unquoteCode(mech.value)) : ''), line);
        }
        this.reportUnmapped(parts, `in flow ${m[1]}`);
    }
}

/** `over "X" manual`, `manual`, `over "X"`, or loosely `X, manual` -> the DSL mechanism clause. */
function mechanismClause(text: string): string {
    const t = text.trim();
    if (!t) return '';
    const mode = /\b(manual|automated)\b/i.exec(t)?.[1]?.toLowerCase();
    let over = /over\s+"([^"]*)"/.exec(t)?.[1];
    if (over === undefined) {
        const rest = t.replace(/\b(manual|automated)\b/gi, '').replace(/^over\s+/i, '').replace(/[,;]\s*$/, '').trim().replace(/^"|"$/g, '');
        if (rest) over = rest;
    }
    return `${over !== undefined && over !== '' ? ` over ${quote(over)}` : ''}${mode ? ` ${mode}` : ''}`;
}

function normalizeGroup(text: string): string {
    return stripInline(text).toLowerCase().replace(/:$/, '').trim();
}

function literalToken(v: string): string {
    const s = unquoteCode(v);
    if (/^-?\d+(\.\d+)?$/.test(s) || s === 'true' || s === 'false' || s === 'null') return s;
    return quote(s.replace(/^"|"$/g, ''));
}

export function architectureFromMarkdown(markdown: string): ReturnType<DslBuilder['result']> {
    const { root, blocks } = sectionsOf(markdown);
    const fm = blocks.find(b => b.type === 'frontmatter');
    const header = fm && fm.type === 'frontmatter' ? parseFrontMatter(fm.text) : {};
    const reader = new ArchitectureReader(header);
    reader.read(root);
    return reader.b.result(header);
}
