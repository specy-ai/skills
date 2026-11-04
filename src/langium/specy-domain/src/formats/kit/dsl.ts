/**
 * Helpers shared by the DSL printers (model -> text). One indentation style,
 * one way to quote a string, one way to tell a bare type name from a label that
 * needs quotes, so the five printers write the same house style.
 */

export class IndentWriter {
    private readonly lines: string[] = [];
    private depth = 0;
    readonly indent: string;

    constructor(indent = '  ') {
        this.indent = indent;
    }

    line(text = ''): this {
        this.lines.push(text === '' ? '' : this.indent.repeat(this.depth) + text);
        return this;
    }

    lines_(rows: string[]): this {
        for (const r of rows) this.line(r);
        return this;
    }

    blank(): this {
        if (this.lines.length && this.lines[this.lines.length - 1] !== '') this.lines.push('');
        return this;
    }

    /** `text {` then indent. */
    open(text: string): this {
        this.line(`${text} {`);
        this.depth++;
        return this;
    }

    close(suffix = ''): this {
        this.depth = Math.max(0, this.depth - 1);
        return this.line(`}${suffix}`);
    }

    /** Run `body` one level deeper, between `head {` and `}`. */
    block(head: string, body: () => void, suffix = ''): this {
        this.open(head);
        body();
        return this.close(suffix);
    }

    /** Lines of another printer's output, re-indented here. */
    raw(text: string): this {
        for (const row of text.replace(/\s+$/, '').split('\n')) this.line(row);
        return this;
    }

    comment(text: string): this {
        for (const row of text.split('\n')) this.line(`// ${row}`);
        return this;
    }

    get currentDepth(): number {
        return this.depth;
    }

    toString(): string {
        return this.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
    }
}

/**
 * A DSL string literal. The lexers stop a string at the first `"`, so a double
 * quote in the text becomes a single quote: the one lossy step of a JSON -> DSL
 * conversion, and a text the DSL could never have held anyway. A backslash is
 * doubled: the parser's string converter reads `\\` as `\` and drops the
 * backslash of any other `\x`.
 */
export function quote(s: string | number | boolean | undefined | null): string {
    if (s === undefined || s === null) return '""';
    return `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, "'").replace(/\r?\n\s*/g, ' ')}"`;
}

/** ` :: "text"` or nothing. */
export function describe(text: string | undefined): string {
    return text ? ` :: ${quote(text)}` : '';
}

export function isTypeName(s: string): boolean {
    return /^[A-Z][a-zA-Z0-9]*$/.test(s);
}

export function isIdent(s: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s);
}

/** A name as the grammar wants it: bare when it is a type name, quoted otherwise. */
export function nameOrString(s: string): string {
    return isTypeName(s) ? s : quote(s);
}

/** An identifier or a quoted label (operation names, condition names, transition triggers). */
export function identOrString(s: string): string {
    return isIdent(s) ? s : quote(s);
}

/** A literal value: strings quoted, numbers and booleans bare. A bare word already shaped like a number stays a number. */
export function literal(v: unknown): string {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (typeof v === 'string') {
        if (/^-?\d+(\.\d+)?$/.test(v) || v === 'true' || v === 'false' || v === 'null') return v;
        return quote(v);
    }
    return quote(JSON.stringify(v));
}

/** `meta { k = v ... }` lines. */
export function metaBlock(w: IndentWriter, metadata: Record<string, unknown> | undefined): void {
    if (!metadata || !Object.keys(metadata).length) return;
    w.open('meta');
    for (const [k, v] of Object.entries(metadata)) w.line(`${k} = ${literal(v)}`);
    w.close();
}

/** `meta { k = v }` on one line, for heads that keep their metadata inline. */
export function metaInline(metadata: Record<string, unknown> | undefined): string {
    if (!metadata || !Object.keys(metadata).length) return '';
    return ` meta { ${Object.entries(metadata)
        .map(([k, v]) => `${k} = ${literal(v)}`)
        .join(' ')} }`;
}

export function satisfiesLine(w: IndentWriter, ids: string[] | undefined): void {
    if (ids?.length) w.line(`satisfies [${ids.join(', ')}]`);
}

export function satisfiesInline(ids: string[] | undefined): string {
    return ids?.length ? ` satisfies [${ids.join(', ')}]` : '';
}

/** `key = value` pairs rendered for a Markdown `**Metadata:**` line and read back by `parseMetaPairs`. */
export function metaPairs(metadata: Record<string, unknown> | undefined): string | undefined {
    if (!metadata || !Object.keys(metadata).length) return undefined;
    return Object.entries(metadata)
        .map(([k, v]) => `${k} = ${literal(v)}`)
        .join(', ');
}

/** The inverse of `metaPairs`: `a = "x", b = 2` -> [['a', '"x"'], ['b', '2']] (values stay DSL literals). */
export function parseMetaPairs(text: string): [string, string][] {
    const out: [string, string][] = [];
    const re = /([A-Za-z_][\w-]*)\s*=\s*("[^"]*"|[^,]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
        const raw = m[2].trim();
        out.push([m[1], /^".*"$/.test(raw) || /^-?\d+(\.\d+)?$/.test(raw) || /^(true|false|null)$/.test(raw) ? raw : quote(raw)]);
    }
    return out;
}
