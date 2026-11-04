/**
 * Block-level Markdown tokenizer for the Specy model readers.
 *
 * The Markdown encoding of a model (src/metamodels/MODEL-FORMATS.md) uses a
 * small, well-defined subset of CommonMark + GFM: YAML front matter, ATX and
 * setext headings, paragraphs, bullet and numbered lists (nested), pipe tables,
 * fenced code, blockquotes, thematic breaks and HTML comments. Nothing else is
 * needed to carry a model, and a reader that knows exactly which blocks exist
 * can report precisely what it did not understand — which is the whole point of
 * reading Markdown: the unmapped remainder goes back to the author or to the
 * skill that rewrites it.
 *
 * Every block keeps its 1-based source line so a diagnostic raised later, by
 * the DSL parser on the text the reader generated, lands on the Markdown line
 * the author wrote. A dependency-free tokenizer is the cheapest way to keep
 * those line numbers (and the browser bundle small).
 */

export interface ListItem {
    /** 1-based line of the marker. */
    line: number;
    /** Item text with continuation lines joined by one space. */
    text: string;
    children: ListItem[];
}

export type Block =
    | { type: 'frontmatter'; line: number; endLine: number; text: string }
    | { type: 'heading'; line: number; level: number; text: string }
    | { type: 'paragraph'; line: number; endLine: number; text: string }
    | { type: 'list'; line: number; endLine: number; ordered: boolean; items: ListItem[] }
    | { type: 'table'; line: number; endLine: number; header: string[]; rows: string[][] }
    | { type: 'code'; line: number; endLine: number; lang: string; text: string }
    | { type: 'quote'; line: number; endLine: number; text: string; blocks: Block[] }
    | { type: 'rule'; line: number }
    | { type: 'comment'; line: number; endLine: number; text: string };

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/;
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*#*[ \t]*$/;
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const SETEXT = /^ {0,3}(=+|-+)[ \t]*$/;
const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/;
const TABLE_DELIM = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const QUOTE = /^ {0,3}>[ ]?(.*)$/;
const HTML_COMMENT_OPEN = /^\s*<!--/;
// A `**Label:** …` line at the margin: a new clause, never the lazy continuation of a list item.
const LABEL_LINE = /^ ?(\*\*|__)[^*_\s]/;

export function parseBlocks(markdown: string, firstLine = 1): Block[] {
    const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
    const blocks: Block[] = [];
    let i = 0;
    const at = (k: number) => firstLine + k;

    // Front matter: `---` on the very first line, closed by `---` or `...`.
    if (lines[0]?.trim() === '---') {
        let j = 1;
        while (j < lines.length && !/^(---|\.\.\.)\s*$/.test(lines[j])) j++;
        if (j < lines.length) {
            blocks.push({ type: 'frontmatter', line: at(0), endLine: at(j), text: lines.slice(1, j).join('\n') });
            i = j + 1;
        }
    }

    while (i < lines.length) {
        const line = lines[i];

        if (line.trim() === '') {
            i++;
            continue;
        }

        // Fenced code — the lang word after the fence names the island's language.
        const fence = FENCE.exec(line);
        if (fence) {
            const marker = fence[1];
            const start = i;
            const body: string[] = [];
            i++;
            while (i < lines.length) {
                const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(lines[i]);
                if (close && close[1][0] === marker[0] && close[1].length >= marker.length) break;
                body.push(lines[i]);
                i++;
            }
            const endLine = at(Math.min(i, lines.length - 1));
            i++;
            blocks.push({ type: 'code', line: at(start), endLine, lang: fence[2] ?? '', text: dedent(body).join('\n') });
            continue;
        }

        if (HTML_COMMENT_OPEN.test(line)) {
            const start = i;
            const text: string[] = [];
            while (i < lines.length) {
                text.push(lines[i]);
                if (lines[i].includes('-->')) break;
                i++;
            }
            const endLine = at(Math.min(i, lines.length - 1));
            i++;
            blocks.push({
                type: 'comment',
                line: at(start),
                endLine,
                text: text.join('\n').replace(/^\s*<!--/, '').replace(/-->\s*$/, '').trim(),
            });
            continue;
        }

        const atx = ATX.exec(line);
        if (atx) {
            blocks.push({ type: 'heading', line: at(i), level: atx[1].length, text: (atx[2] ?? '').trim() });
            i++;
            continue;
        }

        if (RULE.test(line)) {
            blocks.push({ type: 'rule', line: at(i) });
            i++;
            continue;
        }

        if (QUOTE.test(line)) {
            const start = i;
            const inner: string[] = [];
            while (i < lines.length && QUOTE.test(lines[i])) {
                inner.push(QUOTE.exec(lines[i])![1]);
                i++;
            }
            // Lazy continuation: a plain line right after a quote line continues it.
            while (i < lines.length && lines[i].trim() !== '' && !startsBlock(lines[i])) {
                inner.push(lines[i]);
                i++;
            }
            blocks.push({
                type: 'quote',
                line: at(start),
                endLine: at(i - 1),
                text: inner.map(s => s.trim()).filter(Boolean).join(' '),
                blocks: parseBlocks(inner.join('\n'), at(start)),
            });
            continue;
        }

        if (line.includes('|') && i + 1 < lines.length && TABLE_DELIM.test(lines[i + 1]) && lines[i + 1].includes('-')) {
            const start = i;
            const header = splitRow(line);
            i += 2;
            const rows: string[][] = [];
            while (i < lines.length && lines[i].trim() !== '' && lines[i].includes('|')) {
                rows.push(splitRow(lines[i]));
                i++;
            }
            blocks.push({ type: 'table', line: at(start), endLine: at(i - 1), header, rows });
            continue;
        }

        const item = LIST_ITEM.exec(line);
        if (item) {
            const start = i;
            const ordered = /\d/.test(item[2]);
            const stack: { indent: number; items: ListItem[] }[] = [{ indent: -1, items: [] }];
            let last: ListItem | undefined;
            let lastIndent = 0;
            while (i < lines.length) {
                const l = lines[i];
                if (l.trim() === '') {
                    // A blank line ends the list unless the next non-blank line is still an item
                    // or an indented continuation.
                    let k = i + 1;
                    while (k < lines.length && lines[k].trim() === '') k++;
                    const next = k < lines.length ? LIST_ITEM.exec(lines[k]) : null;
                    // The same list goes on only with the same marker family (bullets, or numbers).
                    if ((next && /\d/.test(next[2]) === ordered) || (k < lines.length && /^\s{2,}\S/.test(lines[k]))) {
                        i = k;
                        continue;
                    }
                    break;
                }
                const m = LIST_ITEM.exec(l);
                if (m) {
                    const indent = m[1].replace(/\t/g, '    ').length;
                    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
                    if (last && indent > lastIndent) {
                        stack.push({ indent: lastIndent, items: last.children });
                    }
                    const node: ListItem = { line: at(i), text: m[3].trim(), children: [] };
                    stack[stack.length - 1].items.push(node);
                    last = node;
                    lastIndent = indent;
                    i++;
                    continue;
                }
                if (startsBlock(l) && !/^\s{2,}/.test(l)) break;
                // People rarely leave a blank line between a list and the next `**Label:**` line.
                if (LABEL_LINE.test(l)) break;
                // Continuation of the last item (indented, or lazy).
                if (last) last.text = `${last.text} ${l.trim()}`.trim();
                i++;
            }
            blocks.push({ type: 'list', line: at(start), endLine: at(i - 1), ordered, items: stack[0].items });
            continue;
        }

        // Paragraph: until a blank line or the start of another block. A setext
        // underline right after one line promotes it to a heading.
        const start = i;
        const text: string[] = [line.trim()];
        i++;
        while (i < lines.length && lines[i].trim() !== '') {
            // A setext underline is checked before the block starts: `---` would otherwise read as a rule.
            if (text.length === 1 && SETEXT.test(lines[i])) {
                blocks.push({ type: 'heading', line: at(start), level: lines[i].trim()[0] === '=' ? 1 : 2, text: text[0] });
                i++;
                text.length = 0;
                break;
            }
            if (startsBlock(lines[i])) break;
            text.push(lines[i].trim());
            i++;
        }
        if (text.length) blocks.push({ type: 'paragraph', line: at(start), endLine: at(i - 1), text: text.join(' ') });
    }

    return blocks;
}

function startsBlock(line: string): boolean {
    return (
        FENCE.test(line) ||
        ATX.test(line) ||
        RULE.test(line) ||
        QUOTE.test(line) ||
        LIST_ITEM.test(line) ||
        HTML_COMMENT_OPEN.test(line)
    );
}

/** Split a pipe-table row into trimmed cells; `\|` inside a cell is a literal pipe. */
function splitRow(line: string): string[] {
    const cells: string[] = [];
    let cur = '';
    let s = line.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
    for (let k = 0; k < s.length; k++) {
        const ch = s[k];
        if (ch === '\\' && s[k + 1] === '|') {
            cur += '|';
            k++;
        } else if (ch === '|') {
            cells.push(cur.trim());
            cur = '';
        } else {
            cur += ch;
        }
    }
    cells.push(cur.trim());
    return cells;
}

/** Remove the common leading indentation of a fenced block's lines. */
function dedent(lines: string[]): string[] {
    const indents = lines.filter(l => l.trim() !== '').map(l => /^[ \t]*/.exec(l)![0].length);
    const min = indents.length ? Math.min(...indents) : 0;
    return lines.map(l => l.slice(Math.min(min, /^[ \t]*/.exec(l)![0].length)));
}
