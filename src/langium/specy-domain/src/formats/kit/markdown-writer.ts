/**
 * The Markdown writer every model serializer builds on. It emits the canonical
 * Markdown of src/metamodels/MODEL-FORMATS.md: a front matter naming the
 * language, `kind Name` headings, one `**Label:** value` line per clause,
 * pipe tables for field-like rows, bullet lists for name lists, and fenced
 * `specy` islands for the formal fragments (expressions, operation bodies,
 * state machines) that Markdown has no better shape for.
 *
 * Canonical means: what this writer produces, the language's Markdown reader
 * reads back into the same model. Authors may write looser Markdown; the reader
 * is tolerant. The writer is not: one spelling per construct.
 */
export class MarkdownWriter {
    private readonly lines: string[] = [];

    frontMatter(fields: Record<string, string | number | undefined>): this {
        this.lines.push('---');
        for (const [k, v] of Object.entries(fields)) {
            if (v === undefined || v === '') continue;
            this.lines.push(`${k}: ${yamlScalar(String(v))}`);
        }
        this.lines.push('---');
        return this.blank();
    }

    heading(level: number, text: string): this {
        this.blank();
        this.lines.push(`${'#'.repeat(Math.min(Math.max(level, 1), 6))} ${text}`);
        return this.blank();
    }

    para(text: string | undefined): this {
        if (!text) return this;
        this.lines.push(escapeText(text));
        return this.blank();
    }

    /** `**Label:** value`; nothing when the value is empty. */
    label(label: string, value: string | number | boolean | undefined): this {
        if (value === undefined || value === '' || value === false) return this;
        this.lines.push(`**${label}:** ${value === true ? 'yes' : String(value)}`);
        return this;
    }

    /** `**Label:** a, b, c` for short name lists. */
    labelInline(label: string, items: string[] | undefined): this {
        if (!items?.length) return this;
        return this.label(label, items.join(', '));
    }

    /** A labelled bullet list: `**Label:**` then one `- item` per entry. */
    labelList(label: string, items: string[] | undefined): this {
        if (!items?.length) return this;
        this.endLabels();
        this.lines.push(`**${label}:**`);
        for (const it of items) this.lines.push(`- ${it}`);
        return this.blank();
    }

    list(items: string[] | undefined): this {
        if (!items?.length) return this;
        this.endLabels();
        for (const it of items) this.lines.push(`- ${it}`);
        return this.blank();
    }

    table(header: string[], rows: (string | number | boolean | undefined)[][]): this {
        if (!rows.length) return this;
        this.endLabels();
        this.lines.push(`| ${header.join(' | ')} |`);
        this.lines.push(`|${header.map(() => '---').join('|')}|`);
        for (const r of rows) this.lines.push(`| ${header.map((_, i) => cellText(r[i])).join(' | ')} |`);
        return this.blank();
    }

    code(text: string | undefined, lang = 'specy'): this {
        if (!text || !text.trim()) return this;
        this.endLabels();
        const body = text.replace(/\s+$/, '');
        const fence = body.includes('```') ? '````' : '```';
        this.lines.push(`${fence}${lang}`);
        this.lines.push(body);
        this.lines.push(fence);
        return this.blank();
    }

    quote(text: string | undefined): this {
        if (!text) return this;
        this.endLabels();
        this.lines.push(`> ${escapeText(text)}`);
        return this.blank();
    }

    comment(text: string): this {
        this.endLabels();
        this.lines.push(`<!-- ${text} -->`);
        return this.blank();
    }

    blank(): this {
        if (this.lines.length && this.lines[this.lines.length - 1] !== '') this.lines.push('');
        return this;
    }

    /** Close a run of label lines before a block of another kind. */
    endLabels(): this {
        return this.blank();
    }

    toString(): string {
        return this.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
    }
}

/** Inline code for a formal token (a type, an expression) so emphasis never rewrites it. */
export function code(s: string | undefined): string {
    if (s === undefined || s === '') return '';
    return s.includes('`') ? `\`\` ${s} \`\`` : `\`${s}\``;
}

function cellText(v: string | number | boolean | undefined): string {
    if (v === undefined) return '';
    if (v === true) return 'yes';
    if (v === false) return '';
    return String(v).replace(/\|/g, '\\|').replace(/\n+/g, ' ');
}

/** Escape what Markdown would otherwise read as structure at line start or as emphasis. */
function escapeText(s: string): string {
    return s.replace(/^(\s*)([#>*+-]|\d+[.)])(\s)/, '$1\\$2$3').replace(/\n+/g, ' ');
}

function yamlScalar(s: string): string {
    return /^[A-Za-z0-9_./-]+$/.test(s) && !/^(true|false|null|yes|no|on|off|~)$/i.test(s) && !/^\d/.test(s)
        ? s
        : JSON.stringify(s);
}
