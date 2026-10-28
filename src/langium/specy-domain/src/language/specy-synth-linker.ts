/**
 * Linking errors that name what was expected where. Langium's default message
 * ("Could not resolve reference to DomainRef named 'x'") is true and useless; a
 * scenario author wants to know which entity, field, state or member list the
 * name was checked against, and the closest name in it.
 */
import { DefaultLinker, type AstNodeDescription, type LangiumCoreServices, type LangiumDocuments, type LinkingError, type ReferenceInfo } from 'langium';
import * as ast from '../generated/ast.js';
import { describeNode, domainOf, isMachineStep, isRowSource, previousOf } from './specy-synth-domain-index.js';

export class SpecySynthLinker extends DefaultLinker {
    private readonly documents: LangiumDocuments;

    constructor(services: LangiumCoreServices) {
        super(services);
        this.documents = services.shared.workspace.LangiumDocuments;
    }

    protected override createLinkingError(refInfo: ReferenceInfo, targetDescription?: AstNodeDescription): LinkingError {
        const text = refInfo.reference.$refText;
        const lookup = domainOf(refInfo.container, this.documents);
        let message: string;
        if (!lookup.declared) {
            message = `Cannot resolve '${text}': the scenario declares no domain-source.`;
        } else if (!lookup.index) {
            message = `Cannot resolve '${text}': domain-source "${lookup.declared}" is not loaded.`;
        } else {
            const names = this.scopeProvider.getScope(refInfo).getAllElements().map(d => d.name).toArray();
            message = `${expectation(refInfo, lookup.declared)}${suggest(text, names)}`;
        }
        return { ...refInfo, message, targetDescription };
    }
}

function expectation(refInfo: ReferenceInfo, domainFile: string): string {
    const c = refInfo.container;
    const text = refInfo.reference.$refText;
    const rowSources = `'${text}' is not an entity, aggregate, read-only entity or value type of ${domainFile}.`;
    if (ast.isSynthPath(c) && refInfo.property === 'root') return rowSources;
    if (ast.isGivenDecl(c)) return rowSources;
    if (ast.isPopulationDecl(c)) {
        if (refInfo.property === 'clock') return `'${text}' is not a field of ${c.entity?.$refText ?? '?'}.`;
        return rowSources;
    }
    if (ast.isSynthPathStep(c)) {
        const prev = previousOf(c);
        if (!prev) return `'${text}' cannot be resolved because the segment before it is unknown.`;
        if (isMachineStep(c)) return `'${text}' is not a state machine of ${describeNode(prev)}.`;
        if (ast.isFieldDecl(prev) || ast.isIdentityDecl(prev)) {
            const t = prev.type.$cstNode?.text ?? '?';
            return `'${text}' is not a member of ${describeNode(prev)}: ${t} has no fields to descend into.`;
        }
        return `'${text}' is not a member of ${describeNode(prev)}.`;
    }
    if (ast.isShareEntry(c)) return memberExpectation(text, ast.isShareGroup(c.$container) ? c.$container.$container.dimension : c.$container.dimension, 'share');
    if (ast.isShareGroup(c)) return memberExpectation(text, c.$container.given, 'share given');
    if (ast.isRatePredicate(c)) return memberExpectation(text, c.path, 'rate');
    if (ast.isMixEntry(c)) {
        const path = c.$container.machine;
        const root = path?.root?.ref;
        if (!isRowSource(root)) return `'${text}' cannot be checked: the machine's entity is unknown.`;
        return `'${text}' is not a state of ${pathText(path)}.`;
    }
    return `Could not resolve '${text}'.`;
}

function memberExpectation(text: string, path: ast.SynthPath | undefined, kind: string): string {
    const leaf = path?.steps.at(-1)?.target?.ref ?? path?.root?.ref;
    if (ast.isFieldDecl(leaf) && ast.isPrimitiveType(leaf.type) && leaf.type.value === 'boolean') {
        return `'${text}': ${pathText(path)} is boolean, so the ${kind} takes true and false, not members.`;
    }
    return `'${text}' is not a member of the enum behind ${pathText(path)}.`;
}

export function pathText(path: ast.SynthPath | undefined): string {
    if (!path) return '?';
    return [path.root?.$refText ?? '?', ...path.steps.map(s => s.target?.$refText ?? '?')].join('.');
}

/** " Did you mean 'x'?" for the closest name, or " Known: a, b, c." when the list is short. */
export function suggest(text: string, names: string[]): string {
    if (names.length === 0) return '';
    const lower = text.toLowerCase();
    const ranked = names
        .map(n => ({ n, d: n.toLowerCase() === lower ? 0 : n.toLowerCase().startsWith(lower) || lower.startsWith(n.toLowerCase()) ? 1 : levenshtein(lower, n.toLowerCase()) }))
        .sort((a, b) => a.d - b.d);
    const best = ranked[0];
    if (best.d <= Math.max(2, Math.floor(text.length / 3))) return ` Did you mean '${best.n}'?`;
    const shown = names.slice(0, 8).join(', ');
    return ` Known: ${shown}${names.length > 8 ? ', …' : ''}.`;
}

function levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
        const cur = [i];
        for (let j = 1; j <= n; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = cur;
    }
    return prev[n];
}
