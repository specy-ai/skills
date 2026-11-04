/**
 * Shared machinery of the Markdown readers: the section tree a heading
 * hierarchy builds, the `**Label:** value` lines, tables and lists the
 * conventions use, and the DSL builder that writes the generated text while
 * remembering, for every DSL line, the Markdown line it came from.
 *
 * A reader does not build a model. It transpiles Markdown to DSL and hands the
 * text to the one parser of the language, so Markdown can never mean something
 * the DSL cannot: validation, cross-references and the clean model all come from
 * the same place. What the reader cannot place is reported as a diagnostic on
 * the Markdown line and kept in the DSL as a comment, so nothing is silently
 * dropped and the author (or the skill) sees exactly what to restructure.
 */
import type { Block, ListItem } from './markdown-blocks.js';
import { parseBlocks } from './markdown-blocks.js';
import type { Diagnostic } from './codec.js';

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export interface Section {
    /** Absent on the root. */
    heading?: { level: number; text: string; line: number };
    /** Blocks between this heading and the first sub-heading. */
    blocks: Block[];
    children: Section[];
    parent?: Section;
}

/** Nest the blocks under their headings: a heading owns everything up to the next heading of its level or above. */
export function buildSections(blocks: Block[]): Section {
    const root: Section = { blocks: [], children: [] };
    let current = root;
    const level = (s: Section) => s.heading?.level ?? 0;
    for (const b of blocks) {
        if (b.type === 'heading') {
            while (current !== root && level(current) >= b.level) current = current.parent!;
            const section: Section = { heading: { level: b.level, text: b.text, line: b.line }, blocks: [], children: [], parent: current };
            current.children.push(section);
            current = section;
        } else {
            current.blocks.push(b);
        }
    }
    return root;
}

export function sectionsOf(markdown: string): { root: Section; blocks: Block[] } {
    const blocks = parseBlocks(markdown);
    return { root: buildSections(blocks), blocks };
}

/** All blocks of a section and of its descendants, in document order (a definition may spread over sub-headings). */
export function flattenBlocks(section: Section): Block[] {
    const out: Block[] = [...section.blocks];
    for (const c of section.children) out.push(...flattenBlocks(c));
    return out;
}

// ---------------------------------------------------------------------------
// Headings: `kind Name`, `Kind: Name`, `Name (kind)`, or a plural group word
// ---------------------------------------------------------------------------

export interface KindSpec {
    /** The DSL spelling of the kind, e.g. 'read-only entity'. */
    kind: string;
    /** Accepted heading words, lowercase; the kind itself is always accepted. */
    words?: string[];
    /** Plural group headings that make this kind the default of their sub-headings. */
    group?: string[];
}

export interface HeadingMatch {
    kind: string;
    /** The heading text after the kind word (name, and whatever follows it). */
    rest: string;
    /** True when the kind came from an enclosing group heading, not from the text. */
    defaulted: boolean;
}

export function normalizeWord(s: string): string {
    return stripInline(s)
        .toLowerCase()
        .replace(/[\s_-]+/g, ' ')
        .trim();
}

/** Is the heading a group heading (e.g. "Entities")? Returns the kind it defaults to. */
export function groupKind(text: string, kinds: KindSpec[]): string | undefined {
    const w = normalizeWord(text).replace(/:$/, '').trim();
    for (const k of kinds) {
        if (k.group?.some(g => normalizeWord(g) === w)) return k.kind;
    }
    return undefined;
}

/**
 * Match a heading against the known kinds. Longest kind word wins
 * ("external event" before "event"). With `defaultKind`, a heading made of a
 * bare name takes that kind.
 */
export function matchHeading(text: string, kinds: KindSpec[], defaultKind?: string): HeadingMatch | undefined {
    const clean = stripInline(text).trim();
    const lower = clean.toLowerCase();
    const candidates: { kind: string; word: string }[] = [];
    for (const k of kinds) {
        for (const w of [k.kind, ...(k.words ?? [])]) candidates.push({ kind: k.kind, word: w.toLowerCase() });
    }
    candidates.sort((a, b) => b.word.length - a.word.length);
    for (const c of candidates) {
        const wordRe = c.word.replace(/[-\s]+/g, '[-\\s]+');
        const lead = new RegExp(`^${wordRe}\\s*[:—–-]?\\s+(.+)$`, 'i');
        const m = lead.exec(clean);
        if (m) return { kind: c.kind, rest: m[1].trim(), defaulted: false };
        const trail = new RegExp(`^(.+?)\\s*[(\\[]${wordRe}[)\\]]\\s*$`, 'i');
        const t = trail.exec(clean);
        if (t) return { kind: c.kind, rest: t[1].trim(), defaulted: false };
        if (lower === c.word) return { kind: c.kind, rest: '', defaulted: false };
    }
    if (defaultKind && clean) return { kind: defaultKind, rest: clean, defaulted: true };
    return undefined;
}

// ---------------------------------------------------------------------------
// Inline text
// ---------------------------------------------------------------------------

/** Drop emphasis and code markers, keep their content. Links keep their text. */
export function stripInline(s: string): string {
    return s
        .replace(/`([^`]*)`/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g, '$1$2')
        .replace(/(^|[\s(])_([^_\s][^_]*?)_(?=[\s).,;:!?]|$)/g, '$1$2')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/\\([|*_`#])/g, '$1')
        .trim();
}

/** Unwrap one inline-code span (`x`) or return the text as is. */
export function unquoteCode(s: string): string {
    const m = /^`([^`]*)`$/.exec(s.trim());
    return m ? m[1] : s.trim();
}

// ---------------------------------------------------------------------------
// Labels: `**Label:** value`, `**Label**: value`, several on one line split by ` · ` / ` | `
// ---------------------------------------------------------------------------

export interface LabelValue {
    /** Normalized label: lowercase, single spaces. */
    label: string;
    /** Raw value text (may be empty when the value is the list that follows). */
    value: string;
}

const LABEL_START = /(?:\*\*|__)\s*([^*_][^*_]{0,60}?)\s*:?\s*(?:\*\*|__)\s*:?\s*/g;

/** The bold labels of a paragraph line, in order; undefined when the line carries none at its start. */
export function parseLabels(text: string): LabelValue[] | undefined {
    LABEL_START.lastIndex = 0;
    const starts: { index: number; end: number; label: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = LABEL_START.exec(text))) {
        starts.push({ index: m.index, end: m.index + m[0].length, label: normalizeWord(m[1]) });
    }
    if (!starts.length || text.slice(0, starts[0].index).trim() !== '') return undefined;
    return starts.map((s, i) => {
        const next = starts[i + 1]?.index ?? text.length;
        const value = text
            .slice(s.end, next)
            .replace(/\s*[·|;]\s*$/, '')
            .trim();
        return { label: s.label, value };
    });
}

/** `Label: value` on a list item (bold or plain). */
export function parseItemLabel(text: string): LabelValue | undefined {
    const bold = parseLabels(text);
    if (bold?.length) return bold[0];
    const m = /^([A-Za-z][A-Za-z0-9 _-]{0,40}?)\s*:\s+(.+)$/.exec(stripInline(text));
    return m ? { label: normalizeWord(m[1]), value: m[2].trim() } : undefined;
}

/** Split a comma- (or ` · `-)separated value list; inline code spans are unwrapped. */
export function splitList(value: string): string[] {
    return value
        .split(/\s*(?:,|·|;)\s*/)
        .map(s => unquoteCode(stripInline(s)))
        .filter(Boolean);
}

/** `yes/true/✓` → true, `no/false/✗` → false. */
export function parseFlag(value: string): boolean | undefined {
    const v = stripInline(value).toLowerCase();
    if (/^(yes|true|✓|✔|on|x)$/.test(v) || v === '') return true;
    if (/^(no|false|✗|✘|off|-|—)$/.test(v)) return false;
    return undefined;
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export interface TableBlock {
    header: string[];
    rows: string[][];
    line: number;
}

/** Column index whose header matches one of the names (normalized), else -1. */
export function columnOf(table: TableBlock, ...names: string[]): number {
    const wanted = names.map(normalizeWord);
    return table.header.findIndex(h => wanted.includes(normalizeWord(h)));
}

export function hasColumns(table: TableBlock, ...names: string[]): boolean {
    return names.every(n => columnOf(table, n) !== -1);
}

/** A row as a record keyed by normalized header. */
export function rowRecord(table: TableBlock, row: string[]): Record<string, string> {
    const rec: Record<string, string> = {};
    table.header.forEach((h, i) => {
        rec[normalizeWord(h)] = (row[i] ?? '').trim();
    });
    return rec;
}

/** The first of the names present in the record (normalized keys). */
export function cell(rec: Record<string, string>, ...names: string[]): string {
    for (const n of names) {
        const v = rec[normalizeWord(n)];
        if (v !== undefined && v !== '') return unquoteCode(v);
    }
    return '';
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

/** Item text split on an em/en dash (or ` - `) into head and trailing description. */
export function splitDash(text: string): { head: string; tail?: string } {
    const m = /^(.*?)\s+(?:—|–|-{1,2})\s+(.*)$/.exec(text);
    if (!m) return { head: text.trim() };
    return { head: m[1].trim(), tail: m[2].trim() };
}

export function itemTexts(items: ListItem[]): string[] {
    return items.map(i => i.text);
}

// ---------------------------------------------------------------------------
// Front matter (a flat `key: value` subset of YAML is enough for a header)
// ---------------------------------------------------------------------------

export function parseFrontMatter(text: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const raw of text.split('\n')) {
        const m = /^\s*([A-Za-z_][\w.-]*)\s*:\s*(.*?)\s*$/.exec(raw);
        if (!m) continue;
        let v = m[2];
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        out[m[1]] = v;
    }
    return out;
}

// ---------------------------------------------------------------------------
// The DSL builder: generated text with a line map back to the Markdown source
// ---------------------------------------------------------------------------

export interface MarkdownReadResult {
    /** The generated DSL text, for the language's parser. */
    dsl: string;
    /** What the reader could not place, and what it had to guess. */
    diagnostics: Diagnostic[];
    /** The Markdown line a generated DSL line came from (1-based both ways). */
    mapLine(dslLine: number): number;
    /** Front-matter fields, for the caller (the language, a scenario's domain, …). */
    header: Record<string, string>;
}

export class DslBuilder {
    private readonly lines: { text: string; md?: number }[] = [];
    private depth = 0;
    readonly diagnostics: Diagnostic[] = [];
    readonly indent: string;

    constructor(indent = '  ') {
        this.indent = indent;
    }

    line(text: string, md?: number): this {
        this.lines.push({ text: text === '' ? '' : this.indent.repeat(this.depth) + text, md });
        return this;
    }

    blank(): this {
        if (this.lines.length && this.lines[this.lines.length - 1].text !== '') this.lines.push({ text: '' });
        return this;
    }

    /** Write `text {` and indent what follows. */
    open(text: string, md?: number): this {
        this.line(`${text} {`, md);
        this.depth++;
        return this;
    }

    close(md?: number): this {
        this.depth = Math.max(0, this.depth - 1);
        return this.line('}', md);
    }

    /** Verbatim lines (a fenced DSL island), re-indented at the current depth, each mapped to its Markdown line. */
    raw(text: string, mdFirstLine: number): this {
        const rows = text.replace(/\s+$/, '').split('\n');
        rows.forEach((row, i) => {
            this.lines.push({ text: row === '' ? '' : this.indent.repeat(this.depth) + row, md: mdFirstLine + i });
        });
        return this;
    }

    comment(text: string, md?: number): this {
        for (const row of text.split('\n')) this.line(`// ${row}`, md);
        return this;
    }

    /** Record a Markdown fragment the reader could not place; it stays in the DSL as a comment. */
    unmapped(block: { line: number }, what: string, hint?: string): this {
        this.warn(block.line, `${what} was not mapped to the model${hint ? ` (${hint})` : ''}`, 'MD-UNMAPPED');
        const excerpt = what.length > 100 ? `${what.slice(0, 97)}...` : what;
        return this.comment(`unmapped (markdown line ${block.line}): ${excerpt.replace(/\n/g, ' ')}`, block.line);
    }

    warn(line: number, message: string, code = 'MD-WARN'): this {
        this.diagnostics.push({ severity: 'warning', line, column: 1, message, code, source: 'markdown' });
        return this;
    }

    error(line: number, message: string, code = 'MD-ERROR'): this {
        this.diagnostics.push({ severity: 'error', line, column: 1, message, code, source: 'markdown' });
        return this;
    }

    get currentDepth(): number {
        return this.depth;
    }

    toString(): string {
        return this.lines.map(l => l.text).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
    }

    result(header: Record<string, string> = {}): MarkdownReadResult {
        // The line map must follow toString()'s blank-line squeeze, so compute it on the same rows.
        const rows: { text: string; md?: number }[] = [];
        for (const l of this.lines) {
            if (l.text === '' && rows.length && rows[rows.length - 1].text === '') continue;
            rows.push(l);
        }
        while (rows.length && rows[0].text === '') rows.shift();
        let lastMd = 1;
        const map = rows.map(r => (r.md !== undefined ? (lastMd = r.md) : lastMd));
        return {
            dsl: rows.map(r => r.text).join('\n') + '\n',
            diagnostics: this.diagnostics,
            mapLine: (n: number) => map[Math.min(Math.max(n, 1), map.length) - 1] ?? lastMd,
            header,
        };
    }
}

/** Describe a block in one line, for an unmapped diagnostic. */
export function describeBlock(b: Block): string {
    switch (b.type) {
        case 'paragraph':
            return b.text;
        case 'list':
            return `list: ${b.items.map(i => i.text).join(' / ')}`;
        case 'table':
            return `table with columns ${b.header.join(', ')}`;
        case 'code':
            return `code block${b.lang ? ` (${b.lang})` : ''}`;
        case 'quote':
            return `quote: ${b.text}`;
        case 'heading':
            return `heading: ${b.text}`;
        case 'comment':
            return `comment: ${b.text}`;
        case 'frontmatter':
            return 'front matter';
        case 'rule':
            return 'rule';
    }
}
