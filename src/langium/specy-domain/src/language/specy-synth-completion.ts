/**
 * Completion for what the scope provider cannot offer: the kind after `as` in a
 * vocabulary binding is a name from a closed list (synth-kinds.ts), not a
 * reference into the domain. Everything else is Langium's default.
 */
import { GrammarAST, type MaybePromise } from 'langium';
import { DefaultCompletionProvider, type CompletionAcceptor, type CompletionContext, type NextFeature } from 'langium/lsp';
import { CompletionItemKind } from 'vscode-languageserver';
import { SYNTH_KINDS, type SynthKind } from './synth-kinds.js';

export class SpecySynthCompletionProvider extends DefaultCompletionProvider {
    protected override completionFor(context: CompletionContext, next: NextFeature, acceptor: CompletionAcceptor): MaybePromise<void> {
        // `kind=SynthIdent` expands to ID, TYPE_NAME and the keywords that may name a
        // field: offer the kinds once (on ID) and none of the keywords.
        if (next.property === 'kind') {
            if (GrammarAST.isRuleCall(next.feature) && next.feature.rule.ref?.name === 'ID') {
                SYNTH_KINDS.forEach((k, i) => acceptor(context, { label: k.name, kind: CompletionItemKind.EnumMember, detail: detailOf(k), sortText: String(i).padStart(2, '0') }));
            }
            return;
        }
        return super.completionFor(context, next, acceptor);
    }
}

function detailOf(k: SynthKind): string {
    if (k.name === 'text') return 'text: turns name-based inference off';
    if (!k.length) return k.applies;
    return `${k.applies}, ${k.length.min === k.length.max ? k.length.min : `${k.length.min} to ${k.length.max}`} characters`;
}
