/**
 * Expression printer: the clean JSON tree of a .domain expression back to its
 * text. The normalizer (cli/domain-model.ts) keeps every node that matters —
 * including the parentheses the author wrote (`kind: 'paren'`) — so the text
 * printed here parses to the same tree without the printer having to reason
 * about precedence: it never adds a parenthesis, it only restores them.
 *
 * Node shapes (see `cleanNode` and NODE_KIND in the normalizer):
 *   { kind: 'paren', expr }                 ( … )
 *   { kind: 'not', operand }                not …
 *   { left, op, right }                     a op b   (and, or, ?:, comparisons, + - * /)
 *   { kind: 'conditional', condition, whenTrue, whenFalse }
 *   { kind: 'if', condition, body | whenTrue, whenFalse }
 *   { kind: 'every', variable, collection, body }
 *   { kind: 'exists' | 'forall', variable, collection, predicate? }
 *   { kind: 'isDefined' | 'isNotDefined' | 'isNull' | 'isNotNull', path }
 *   { kind: 'in' | 'notIn', path, values: { values } }
 *   { kind: 'matches', left, pattern: { value } }
 *   { kind: 'contains', left, target, negated? }
 *   { kind: 'duration', amount, unit }
 *   { kind: 'call', path, args? }
 *   { kind: 'null' } | { value: string | number | boolean }   literals
 *   { path }                                a dot path
 *   { first, more? }                        [ array literal ]
 */

type Node = Record<string, unknown>;

export function printExpression(e: unknown): string {
    if (e === undefined || e === null) return '';
    if (typeof e === 'string') return e;
    if (typeof e === 'number' || typeof e === 'boolean') return String(e);
    if (Array.isArray(e)) return e.map(printExpression).join(', ');
    const n = e as Node;
    const p = printExpression;
    switch (n.kind) {
        case 'paren':
            return `(${p(n.expr)})`;
        case 'not':
            return `not ${p(n.operand)}`;
        case 'conditional':
            return `${p(n.condition)} ? ${p(n.whenTrue)} : ${p(n.whenFalse)}`;
        case 'if':
            return n.body !== undefined
                ? `if ${p(n.condition)} { ${p(n.body)} }`
                : `if ${p(n.condition)} then ${p(n.whenTrue)} else ${p(n.whenFalse)}`;
        case 'every':
            return `every ${n.variable} in ${n.collection} { ${p(n.body)} }`;
        case 'exists':
        case 'forall':
            return `${n.kind} ${n.variable} in ${n.collection}${n.predicate !== undefined ? ` where ${p(n.predicate)}` : ''}`;
        case 'isDefined':
            return `${n.path} is defined`;
        case 'isNotDefined':
            return `${n.path} is not defined`;
        case 'isNull':
            return `${n.path} is null`;
        case 'isNotNull':
            return `${n.path} is not null`;
        case 'in':
            return `${n.path} in { ${printValueList(n.values)} }`;
        case 'notIn':
            return `${n.path} not in { ${printValueList(n.values)} }`;
        case 'matches':
            return `${p(n.left)} matches ${printPattern(n.pattern)}`;
        case 'contains':
            return `${p(n.left)} ${n.negated ? 'does not contain' : 'contains'} ${n.target}`;
        case 'duration':
            return `${n.amount} ${n.unit}`;
        case 'call':
            return `${p(n.path)}(${printArgs(n.args)})`;
        case 'null':
            return 'null';
        case 'string':
            return printLiteral(String(n.value ?? ''));
        case 'number':
        case 'boolean':
            return String(n.value);
        default:
            break;
    }
    if ('op' in n && 'left' in n) return `${p(n.left)} ${n.op} ${p(n.right)}`;
    if ('first' in n) return `[${[n.first, ...((n.more as unknown[]) ?? [])].map(p).join(', ')}]`;
    if ('value' in n && Object.keys(n).length <= 2) return printLiteral(n.value);
    if ('path' in n && typeof n.path === 'string') return printPath(n.path);
    // Unknown node: keep it visible rather than silently dropping it.
    return `/* unprintable expression ${JSON.stringify(n)} */`;
}

/**
 * A dot path as the normalizer joined it. A segment that is not an identifier
 * was a quoted segment (`Order."Place the order"`), or a string literal that the
 * grammar parsed as a one-segment path: it goes back between quotes.
 */
export function printPath(path: string): string {
    if (/^[A-Za-z_]\w*(\.[A-Za-z_]\w*)*$/.test(path) || path === '') return path;
    if (!path.includes('.') || /\s/.test(path.split('.')[0]) && !/^[A-Za-z_]\w*\./.test(path)) return printLiteral(path);
    return path
        .split('.')
        .map(seg => (/^[A-Za-z_]\w*$/.test(seg) || /^\[.*\]$/.test(seg) ? seg : printLiteral(seg)))
        .join('.');
}

export function printLiteral(v: unknown): string {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return `"${String(v).replace(/"/g, "'")}"`;
}

function printPattern(pattern: unknown): string {
    const v = pattern && typeof pattern === 'object' ? (pattern as Node).value : pattern;
    const s = String(v ?? '');
    // The REGEX terminal: a bracket expression with a lowercase letter inside and a quantifier.
    return /^\[[^\]]*[a-z][^\]]*\][*+?]$/.test(s) ? s : printLiteral(s);
}

function printValueList(values: unknown): string {
    const list = values && typeof values === 'object' && Array.isArray((values as Node).values) ? ((values as Node).values as unknown[]) : Array.isArray(values) ? values : [];
    return list.map(printExpression).join(', ');
}

/** `{ args: [...] }` (positional) or `{ namedArgs: { args: [{ name, value }] } }`. */
export function printArgs(args: unknown): string {
    if (!args || typeof args !== 'object') return '';
    const a = args as Node;
    if (Array.isArray(a.args)) return (a.args as unknown[]).map(printExpression).join(', ');
    const named = a.namedArgs && typeof a.namedArgs === 'object' ? ((a.namedArgs as Node).args as Node[] | undefined) : undefined;
    if (Array.isArray(named)) return named.map(x => `${x.name} = ${printExpression(x.value)}`).join(', ');
    return '';
}
