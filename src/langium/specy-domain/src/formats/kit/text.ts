/**
 * Text normalization shared by the normalizers.
 *
 * A DSL string may span lines, indented to the clause it belongs to. The
 * document keeps the words, not the layout: every line break and the
 * indentation after it collapse to one space, so JSON, YAML and Markdown carry
 * one-line texts and a model parsed twice compares equal whatever the wrapping.
 */
export function collapse(text: string | undefined): string | undefined {
    if (text === undefined) return undefined;
    return text.replace(/\s*\r?\n\s*/g, ' ').trim();
}

/** Drop undefined-valued keys so emitted JSON/YAML stays tidy. */
export function compact<T extends object>(obj: T): T {
    const rec = obj as Record<string, unknown>;
    for (const k of Object.keys(rec)) {
        if (rec[k] === undefined) delete rec[k];
    }
    return obj;
}

export function nonEmpty<T>(arr: T[] | undefined): T[] | undefined {
    return arr && arr.length > 0 ? arr : undefined;
}

/** Deep structural equality on plain JSON values, with key order ignored. */
export function jsonEqual(a: unknown, b: unknown): boolean {
    return canonicalJson(a) === canonicalJson(b);
}

/** JSON with object keys sorted at every level, for diffs and equality. */
export function canonicalJson(v: unknown): string {
    return JSON.stringify(sortKeys(v));
}

function sortKeys(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === 'object') {
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(v as object).sort()) out[k] = sortKeys((v as Record<string, unknown>)[k]);
        return out;
    }
    return v;
}

/** The first differences between two JSON values, as `path: a != b` lines (key order ignored). */
export function jsonDiff(a: unknown, b: unknown, limit = 10): string[] {
    const out: string[] = [];
    const walk = (x: unknown, y: unknown, path: string): void => {
        if (out.length >= limit) return;
        if (Array.isArray(x) && Array.isArray(y)) {
            if (x.length !== y.length) out.push(`${path}: length ${x.length} != ${y.length}`);
            for (let i = 0; i < Math.min(x.length, y.length); i++) walk(x[i], y[i], `${path}[${i}]`);
            return;
        }
        if (x && y && typeof x === 'object' && typeof y === 'object' && !Array.isArray(x) && !Array.isArray(y)) {
            const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
            for (const k of [...keys].sort()) {
                const xv = (x as Record<string, unknown>)[k];
                const yv = (y as Record<string, unknown>)[k];
                if (xv === undefined && yv !== undefined) out.push(`${path}.${k}: missing on the left, right = ${JSON.stringify(yv)?.slice(0, 120)}`);
                else if (yv === undefined && xv !== undefined) out.push(`${path}.${k}: left = ${JSON.stringify(xv)?.slice(0, 120)}, missing on the right`);
                else walk(xv, yv, `${path}.${k}`);
            }
            return;
        }
        if (canonicalJson(x) !== canonicalJson(y)) out.push(`${path}: ${JSON.stringify(x)?.slice(0, 120)} != ${JSON.stringify(y)?.slice(0, 120)}`);
    };
    walk(a, b, '$');
    return out;
}
