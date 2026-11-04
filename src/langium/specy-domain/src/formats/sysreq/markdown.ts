/**
 * The Markdown encoding of a requirements document — writer and reader.
 *
 * Writer (document -> Markdown): the canonical document of
 * src/metamodels/MODEL-FORMATS.md, "System requirements". A requirement set is
 * a `# requirements "Name" scoped-to Context` heading, its modules
 * `## module Name` headings, each requirement a `REQ-… Name` heading; the
 * clauses are `**Label:** value` lines and the EARS statement a blockquote, so
 * the document reads as the requirements review people already write.
 *
 * Reader (Markdown -> DSL): tolerant of the spellings a reviewer or a language
 * model uses (`## Requirements` group headings, `- Priority: must` lists,
 * `**Why:**` for the rationale, a plain paragraph for the statement, a table
 * of requirements), it transpiles what it recognizes to DSL and reports the
 * rest as unmapped, line by line. A missing pattern, statement or priority is
 * an error naming the label to add.
 */
import type { Block, ListItem } from '../kit/markdown-blocks.js';
import { quote } from '../kit/dsl.js';
import { MarkdownWriter, code } from '../kit/markdown-writer.js';
import {
    DslBuilder,
    cell,
    columnOf,
    describeBlock,
    flattenBlocks,
    matchHeading,
    normalizeWord,
    parseFrontMatter,
    parseItemLabel,
    parseLabels,
    rowRecord,
    sectionsOf,
    splitList,
    stripInline,
    unquoteCode,
    type KindSpec,
    type Section,
} from '../kit/markdown-reader.js';
import type { Requirement, RequirementModule, RequirementSet, SatisfactionLink, SysreqDocument } from './model.js';
import { linkText } from './printer.js';

// ---------------------------------------------------------------------------
// Kinds and vocab — one table drives the writer's headings and the reader's matching
// ---------------------------------------------------------------------------

export const SET_KINDS: KindSpec[] = [{ kind: 'requirements', words: ['requirement set', 'requirements set', 'system requirements'] }];

export const MODULE_KINDS: KindSpec[] = [{ kind: 'module', group: ['modules'] }];

/** `REQ-<SEGMENT>[-<SEGMENT>]-<NNN>`, optionally preceded by the word "requirement". */
const REQ_HEADING = /^(?:requirement\s*[:—–-]?\s*)?(REQ-[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d{3})\s*[:—–-]?\s*(.*)$/i;

export const EARS_PATTERNS = ['ubiquitous', 'state-driven', 'event-driven', 'unwanted', 'optional', 'complex'];
export const PRIORITIES = ['must', 'should', 'could', 'wont'];
const ROLES = ['implemented-by', 'structured-by', 'enforced-by', 'detected-by', 'quality-constrained-by'];

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

export function sysreqToMarkdown(doc: SysreqDocument): string {
    const w = new MarkdownWriter();
    w.frontMatter({ specy: 'sysreq' });
    for (const set of doc.requirementSets ?? []) writeSet(w, set);
    return w.toString();
}

function writeSet(w: MarkdownWriter, set: RequirementSet): void {
    w.heading(1, `requirements "${set.name}" scoped-to ${set.scope}`);
    for (const p of set.prdSources ?? []) w.label('PRD source', p);
    w.blank();
    for (const r of set.requirements ?? []) writeRequirement(w, r, 2);
    for (const m of set.modules ?? []) writeModule(w, m, 2);
}

function writeModule(w: MarkdownWriter, m: RequirementModule, level: number): void {
    w.heading(level, `module ${m.name}`);
    for (const r of m.requirements ?? []) writeRequirement(w, r, level + 1);
}

function writeRequirement(w: MarkdownWriter, r: Requirement, level: number): void {
    w.heading(level, `${r.id} ${r.name}`);
    w.label('Pattern', r.pattern);
    w.label('Priority', r.priority);
    w.label('Source', r.source);
    w.label('Rationale', r.rationale);
    w.quote(r.statement);
    w.labelInline('Depends on', r.dependsOn);
    w.labelInline('Conflicts with', r.conflictsWith);
    w.labelInline('Decomposed into', r.decomposedInto);
    w.labelList(
        'Satisfied by',
        r.satisfiedBy?.map(l => linkItem(l)),
    );
    w.blank();
}

function linkItem(l: SatisfactionLink): string {
    return l.target ? `${l.role} ${code(l.target)}` : l.role;
}

// ---------------------------------------------------------------------------
// Reader
// ---------------------------------------------------------------------------

interface Label {
    label: string;
    value: string;
    line: number;
    list?: string[];
}

interface Parts {
    labels: Label[];
    paragraphs: { text: string; line: number }[];
    quotes: { text: string; line: number }[];
    tables: { header: string[]; rows: string[][]; line: number }[];
    lists: { items: ListItem[]; line: number }[];
    unmapped: Block[];
}

function collectParts(blocks: Block[]): Parts {
    const parts: Parts = { labels: [], paragraphs: [], quotes: [], tables: [], lists: [], unmapped: [] };
    let pending: Label | undefined;
    for (const b of blocks) {
        switch (b.type) {
            case 'paragraph': {
                const labels = parseLabels(b.text);
                if (labels) {
                    for (const l of labels) parts.labels.push({ ...l, line: b.line });
                    const last = parts.labels[parts.labels.length - 1];
                    pending = last.value === '' ? last : undefined;
                } else {
                    parts.paragraphs.push({ text: stripInline(b.text), line: b.line });
                    pending = undefined;
                }
                break;
            }
            case 'quote':
                parts.quotes.push({ text: stripInline(b.text), line: b.line });
                pending = undefined;
                break;
            case 'list':
                if (pending) {
                    pending.list = b.items.map(i => i.text);
                    pending = undefined;
                } else if (b.items.every(i => parseItemLabel(i.text))) {
                    for (const i of b.items) {
                        const l = parseItemLabel(i.text)!;
                        parts.labels.push({ label: l.label, value: l.value, line: i.line, list: i.children.length ? i.children.map(c => c.text) : undefined });
                    }
                } else {
                    parts.lists.push({ items: b.items, line: b.line });
                }
                break;
            case 'table':
                parts.tables.push({ header: b.header, rows: b.rows, line: b.line });
                pending = undefined;
                break;
            case 'code':
                parts.unmapped.push(b);
                pending = undefined;
                break;
            default:
                break;
        }
    }
    return parts;
}

/** What a requirement is made of, whichever Markdown shape it came from. */
interface Fields {
    line: number;
    id?: string;
    name?: string;
    pattern?: string;
    priority?: string;
    rationale?: string;
    source?: string;
    statement?: string;
    dependsOn: string[];
    conflictsWith: string[];
    decomposedInto: string[];
    satisfiedBy: { text: string; line: number }[];
    lines: Partial<Record<'pattern' | 'priority' | 'statement' | 'id', number>>;
}

const ID_RE = /^REQ-[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d{3}$/;

class SysreqReader {
    readonly b = new DslBuilder('  ');

    read(root: Section): void {
        this.reportUnmapped(collectParts(root.blocks), 'before the first heading');
        this.emitRoot(root);
    }

    private reportUnmapped(parts: Parts, where: string): void {
        for (const u of parts.unmapped) this.b.unmapped(u, describeBlock(u), where);
        for (const l of parts.labels) this.b.unmapped({ line: l.line }, `label "${l.label}"`, where);
        for (const p of parts.paragraphs) this.b.unmapped({ line: p.line }, p.text, where);
        for (const q of parts.quotes) this.b.unmapped({ line: q.line }, `quote: ${q.text}`, where);
        for (const t of parts.tables) this.b.unmapped({ line: t.line }, `table with columns ${t.header.join(', ')}`, where);
        for (const l of parts.lists) this.b.unmapped({ line: l.line }, `list: ${l.items.map(i => i.text).join(' / ')}`, where);
    }

    private take(parts: Parts, ...labels: string[]): Label | undefined {
        const i = parts.labels.findIndex(l => labels.includes(l.label));
        return i === -1 ? undefined : parts.labels.splice(i, 1)[0];
    }

    private takeAll(parts: Parts, ...labels: string[]): Label[] {
        const out: Label[] = [];
        for (let i = parts.labels.length - 1; i >= 0; i--) {
            if (labels.includes(parts.labels[i].label)) out.unshift(parts.labels.splice(i, 1)[0]);
        }
        return out;
    }

    private listOf(l: Label | undefined): string[] {
        if (!l) return [];
        if (l.list) return l.list.map(s => unquoteCode(stripInline(s)));
        return splitList(l.value);
    }

    // -- top level ---------------------------------------------------------------

    private emitRoot(root: Section): void {
        for (const child of root.children) {
            const text = child.heading!.text;
            const set = matchHeading(text, SET_KINDS);
            if (set) {
                this.emitSet(child, set.rest);
                continue;
            }
            if (REQ_HEADING.test(stripInline(text))) {
                this.b.error(child.heading!.line, `requirement "${text}" sits outside a requirement set: add a "# requirements \\"Name\\" scoped-to Context" heading above it`, 'MD-NO-SET');
                continue;
            }
            // A title or a section that is not a set: read its sub-headings in place.
            this.b.warn(child.heading!.line, `heading "${text}" names no requirement set; its sub-headings are read in place`, 'MD-HEADING');
            this.reportUnmapped(collectParts(child.blocks), `under the heading "${text}"`);
            this.emitRoot(child);
        }
    }

    private emitSet(section: Section, rest: string): void {
        const line = section.heading!.line;
        const parts = collectParts(section.blocks);
        let name = '';
        let scope = '';
        const m = /^"?(.*?)"?\s+scoped[-\s]to\s+(\S+)\s*$/i.exec(rest);
        if (m) {
            name = m[1].trim();
            scope = m[2].trim();
        } else {
            name = rest.replace(/^"|"$/g, '').replace(/^[:—–-]\s*/, '').trim();
        }
        const nameLabel = this.take(parts, 'name', 'title');
        if (!name && nameLabel) name = stripInline(nameLabel.value);
        const scopeLabel = this.take(parts, 'scope', 'scoped to', 'context', 'bounded context', 'organization');
        if (scopeLabel) scope = unquoteCode(stripInline(scopeLabel.value)).split(/\s+/)[0];
        if (!name) this.b.error(line, 'the requirement set needs a name: "# requirements \\"Name\\" scoped-to Context"', 'MD-SET-NAME');
        if (!scope) {
            this.b.error(line, `requirement set "${name}" names no scope: write "scoped-to Context" in the heading or a **Scope:** line`, 'MD-SCOPE');
            scope = 'UnknownScope';
        }
        this.b.blank();
        this.b.open(`requirements ${quote(name)} scoped-to ${scope}`, line);
        for (const l of this.takeAll(parts, 'prd source', 'prd sources', 'prd', 'product requirements', 'source prd', 'prd file')) {
            for (const p of this.listOf(l)) this.b.line(`prd-source ${quote(p)}`, l.line);
        }
        this.emitTables(parts);
        this.reportUnmapped(parts, `in requirements "${name}"`);
        this.emitMembers(section, undefined);
        this.b.close(line);
        this.b.blank();
    }

    /** The children of a set or module: requirements, modules, group headings, or transparent headings. */
    private emitMembers(section: Section, defaultKind: 'module' | 'requirement' | undefined): void {
        for (const child of section.children) {
            const text = stripInline(child.heading!.text);
            const line = child.heading!.line;
            const req = REQ_HEADING.exec(text);
            if (req) {
                this.emitRequirement(child, req[1].toUpperCase(), req[2].trim());
                continue;
            }
            const w = normalizeWord(text).replace(/:$/, '');
            if (w === 'requirements' || w === 'modules') {
                this.reportUnmappedButTables(child, `under the group heading "${text}"`);
                this.emitMembers(child, w === 'modules' ? 'module' : 'requirement');
                continue;
            }
            const mod = matchHeading(text, MODULE_KINDS, defaultKind === 'module' ? 'module' : undefined);
            if (mod) {
                if (mod.defaulted) this.b.warn(line, `"${text}" read as module ${mod.rest} (from the group heading above it)`, 'MD-DEFAULT-KIND');
                this.emitModule(child, mod.rest);
                continue;
            }
            if (defaultKind === 'requirement') {
                // A bare name under "Requirements": the id must then come from an **Id:** line.
                this.emitRequirement(child, undefined, text);
                continue;
            }
            if (child.children.some(c => REQ_HEADING.test(stripInline(c.heading!.text)))) {
                this.b.warn(line, `"${text}" read as module "${text}" (it holds requirements)`, 'MD-DEFAULT-KIND');
                this.emitModule(child, text);
                continue;
            }
            this.b.warn(line, `heading "${text}" names no module or requirement; its sub-headings are read in place`, 'MD-HEADING');
            this.reportUnmappedButTables(child, `under the heading "${text}"`);
            this.emitMembers(child, defaultKind);
        }
    }

    /** A group or transparent heading may still carry a requirements table. */
    private reportUnmappedButTables(section: Section, where: string): void {
        const parts = collectParts(section.blocks);
        this.emitTables(parts);
        this.reportUnmapped(parts, where);
    }

    private emitModule(section: Section, rest: string): void {
        const line = section.heading!.line;
        const name = unquoteCode(rest).replace(/^"|"$/g, '').trim();
        const parts = collectParts(section.blocks);
        this.b.open(`module ${quote(name)}`, line);
        this.emitTables(parts);
        this.reportUnmapped(parts, `in module "${name}"`);
        this.emitMembers(section, undefined);
        this.b.close(line);
        this.b.blank();
    }

    // -- requirements --------------------------------------------------------------

    private emitRequirement(section: Section, id: string | undefined, headName: string): void {
        const line = section.heading!.line;
        const parts = collectParts(flattenBlocks(section));
        const f: Fields = { line, id, name: headName || undefined, dependsOn: [], conflictsWith: [], decomposedInto: [], satisfiedBy: [], lines: {} };

        const idLabel = this.take(parts, 'id', 'identifier', 'requirement id');
        if (idLabel) {
            f.id ??= unquoteCode(stripInline(idLabel.value)).toUpperCase();
            f.lines.id = idLabel.line;
        }
        const nameLabel = this.take(parts, 'name', 'title');
        if (nameLabel) f.name ??= stripInline(nameLabel.value);

        const pattern = this.take(parts, 'pattern', 'ears pattern', 'ears', 'type', 'kind');
        if (pattern) {
            f.pattern = stripInline(pattern.value).toLowerCase().replace(/\s+/g, '-');
            f.lines.pattern = pattern.line;
        }
        const priority = this.take(parts, 'priority', 'moscow', 'level');
        if (priority) {
            f.priority = normalizePriority(priority.value);
            f.lines.priority = priority.line;
        }
        const rationale = this.take(parts, 'rationale', 'why', 'justification', 'reason', 'because');
        if (rationale) f.rationale = stripInline(rationale.value);
        const source = this.take(parts, 'source', 'traces to', 'prd element', 'origin', 'from', 'prd source');
        if (source) f.source = stripInline(source.value);
        const statement = this.take(parts, 'statement', 'ears statement', 'requirement', 'shall', 'text');
        if (statement) {
            f.statement = stripInline(statement.value);
            f.lines.statement = statement.line;
        } else if (parts.quotes.length) {
            const q = parts.quotes.shift()!;
            f.statement = q.text;
            f.lines.statement = q.line;
        } else if (parts.paragraphs.length) {
            const p = parts.paragraphs.shift()!;
            f.statement = p.text;
            f.lines.statement = p.line;
            this.b.warn(p.line, `the paragraph "${p.text.slice(0, 40)}…" was read as the EARS statement of ${f.id ?? headName} (write it as a > blockquote or a **Statement:** line)`, 'MD-STATEMENT-PARAGRAPH');
        }

        f.dependsOn = this.ids(this.take(parts, 'depends on', 'dependencies', 'depends', 'requires', 'prerequisites'), 'depends on');
        f.conflictsWith = this.ids(this.take(parts, 'conflicts with', 'conflicts', 'tension', 'in tension with'), 'conflicts with');
        f.decomposedInto = this.ids(this.take(parts, 'decomposed into', 'decomposes into', 'decomposition', 'children', 'derived', 'derived requirements'), 'decomposed into');
        const sat = this.take(parts, 'satisfied by', 'satisfaction', 'realized by', 'realised by', 'traceability', 'domain', 'domain elements');
        if (sat) {
            const items = sat.list ?? (sat.value ? sat.value.split(/\s*(?:;|·)\s*/) : []);
            f.satisfiedBy = items.map(text => ({ text, line: sat.line }));
        }

        this.emitFields(f);
        this.reportUnmapped(parts, `in requirement ${f.id ?? headName}`);
    }

    private ids(l: Label | undefined, what: string): string[] {
        if (!l) return [];
        const out: string[] = [];
        for (const v of this.listOf(l)) {
            const id = v.toUpperCase().replace(/\s.*$/, '');
            if (ID_RE.test(id)) out.push(id);
            else this.b.unmapped({ line: l.line }, `${what}: "${v}"`, 'expected a requirement id such as REQ-ORD-001');
        }
        return out;
    }

    /** A table of requirements: one row each; columns id, name, pattern, priority, statement, source, rationale. */
    private emitTables(parts: Parts): void {
        for (let i = parts.tables.length - 1; i >= 0; i--) {
            const t = parts.tables[i];
            if (columnOf(t, 'id', 'requirement', 'req') === -1 || columnOf(t, 'statement', 'ears statement', 'requirement text', 'shall') === -1) continue;
            parts.tables.splice(i, 1);
            t.rows.forEach((row, n) => {
                const rec = rowRecord(t, row);
                const line = t.line + 2 + n;
                const idCell = cell(rec, 'id', 'requirement', 'req');
                if (!idCell) return;
                const f: Fields = {
                    line,
                    id: idCell.toUpperCase(),
                    name: stripInline(cell(rec, 'name', 'title')) || undefined,
                    pattern: (stripInline(cell(rec, 'pattern', 'ears pattern', 'ears', 'type')) || undefined)?.toLowerCase().replace(/\s+/g, '-'),
                    priority: cell(rec, 'priority', 'moscow') ? normalizePriority(cell(rec, 'priority', 'moscow')) : undefined,
                    rationale: stripInline(cell(rec, 'rationale', 'why', 'justification')) || undefined,
                    source: stripInline(cell(rec, 'source', 'traces to')) || undefined,
                    statement: stripInline(cell(rec, 'statement', 'ears statement', 'requirement text', 'shall')) || undefined,
                    dependsOn: splitList(cell(rec, 'depends on', 'dependencies')).map(s => s.toUpperCase()).filter(s => ID_RE.test(s)),
                    conflictsWith: splitList(cell(rec, 'conflicts with')).map(s => s.toUpperCase()).filter(s => ID_RE.test(s)),
                    decomposedInto: splitList(cell(rec, 'decomposed into')).map(s => s.toUpperCase()).filter(s => ID_RE.test(s)),
                    satisfiedBy: cell(rec, 'satisfied by') ? cell(rec, 'satisfied by').split(/\s*(?:;|·)\s*/).map(text => ({ text, line })) : [],
                    lines: { id: line, pattern: line, priority: line, statement: line },
                };
                this.emitFields(f);
            });
        }
    }

    private emitFields(f: Fields): void {
        const where = f.id ?? f.name ?? 'the requirement';
        if (!f.id || !ID_RE.test(f.id)) {
            this.b.error(f.lines.id ?? f.line, `${where} has no requirement id (REQ-<CONTEXT>-<NNN>): put it first in the heading or on an **Id:** line`, 'MD-ID');
            f.id = f.id ?? 'REQ-UNKNOWN-000';
        }
        if (!f.name) {
            this.b.warn(f.line, `${f.id} has no name after its id; the id is used as the name`, 'MD-NAME');
            f.name = f.id;
        }
        if (!f.pattern) {
            this.b.error(f.line, `${f.id} needs a **Pattern:** line (${EARS_PATTERNS.join(', ')})`, 'MD-PATTERN');
            f.pattern = 'ubiquitous';
        } else if (!EARS_PATTERNS.includes(f.pattern)) {
            this.b.error(f.lines.pattern ?? f.line, `${f.id}: "${f.pattern}" is not an EARS pattern (${EARS_PATTERNS.join(', ')})`, 'MD-PATTERN');
        }
        if (!f.statement) {
            this.b.error(f.line, `${f.id} needs its EARS statement (a > blockquote or a **Statement:** line)`, 'MD-STATEMENT');
            f.statement = '';
        }
        if (!f.priority) {
            this.b.error(f.line, `${f.id} needs a **Priority:** line (${PRIORITIES.join(', ')})`, 'MD-PRIORITY');
            f.priority = 'must';
        } else if (!PRIORITIES.includes(f.priority)) {
            this.b.error(f.lines.priority ?? f.line, `${f.id}: "${f.priority}" is not a MoSCoW priority (${PRIORITIES.join(', ')})`, 'MD-PRIORITY');
        }

        this.b.blank();
        this.b.line(`${f.id} ${quote(f.name)} : ${f.pattern}`, f.line);
        const i = this.b.indent;
        if (f.rationale) this.b.line(`${i}:: ${quote(f.rationale)}`, f.line);
        if (f.source) this.b.line(`${i}source ${quote(f.source)}`, f.line);
        this.b.line(`${i}${quote(f.statement)}`, f.lines.statement ?? f.line);
        this.b.line(`${i}priority ${f.priority}`, f.lines.priority ?? f.line);
        if (f.dependsOn.length) this.b.line(`${i}depends-on ${f.dependsOn.join(', ')}`, f.line);
        if (f.conflictsWith.length) this.b.line(`${i}conflicts-with ${f.conflictsWith.join(', ')}`, f.line);
        if (f.decomposedInto.length) this.b.line(`${i}decomposed-into { ${f.decomposedInto.join(' ')} }`, f.line);
        if (f.satisfiedBy.length) {
            const links = f.satisfiedBy.map(s => this.link(s.text, s.line)).filter((s): s is string => s !== undefined);
            if (links.length) {
                this.b.line(`${i}satisfied-by {`, f.line);
                for (const l of links) this.b.line(`${i}${i}${l}`, f.line);
                this.b.line(`${i}}`, f.line);
            }
        }
    }

    /** `implemented-by Order."Place order"` (also `implemented by`, `Implemented-By`); `satisfied-by-infrastructure` / `infrastructure`. */
    private link(text: string, line: number): string | undefined {
        const s = unquoteCode(stripInline(text)).trim();
        if (/^(satisfied[-\s]by[-\s])?infrastructure$/i.test(s)) return 'satisfied-by-infrastructure';
        const m = /^([a-z]+(?:-[a-z]+)?)[-\s]by\s*[:—–-]?\s+(.+)$/i.exec(s);
        if (m) {
            const role = `${m[1].toLowerCase()}-by`;
            if (ROLES.includes(role)) return `${role} ${unquoteCode(m[2]).trim()}`;
        }
        this.b.unmapped({ line }, `satisfied-by entry "${text}"`, `expected "<${ROLES.join(' | ')}> Element" or "satisfied-by-infrastructure"`);
        return undefined;
    }
}

function normalizePriority(value: string): string {
    const v = stripInline(value).toLowerCase().replace(/['’]/g, '').trim();
    if (/^won?t/.test(v)) return 'wont';
    const first = v.split(/[\s(]/)[0];
    return first;
}

export function sysreqFromMarkdown(markdown: string): ReturnType<DslBuilder['result']> {
    const { root, blocks } = sectionsOf(markdown);
    const fm = blocks.find(b => b.type === 'frontmatter');
    const header = fm && fm.type === 'frontmatter' ? parseFrontMatter(fm.text) : {};
    const reader = new SysreqReader();
    reader.read(root);
    return reader.b.result(header);
}
