/**
 * Cross-file scoping for .synth: every reference resolves into the .domain the
 * scenario declares with `domain-source`, never into the .synth itself.
 *
 * The scope of a segment is computed from the previous one — `Order.` offers the
 * identity, fields, references and machines of Order; `Order.totalAmount.` the
 * fields of Money — so completion, go-to-definition and "unknown name" errors
 * all come from the same walk the generator performs.
 *
 * References carry the target document's URI, so Langium relinks and revalidates
 * a .synth file when its .domain changes.
 */
import { DefaultScopeProvider, EMPTY_SCOPE, type AstNode, type LangiumCoreServices, type LangiumDocuments, type ReferenceInfo, type Scope } from 'langium';
import * as ast from '../generated/ast.js';
import { DomainAstIndex, domainOf, givenRowsOf, isMachineStep, isRowSource, previousOf } from './specy-synth-domain-index.js';

export class SpecySynthScopeProvider extends DefaultScopeProvider {
    private readonly documents: LangiumDocuments;

    constructor(services: LangiumCoreServices) {
        super(services);
        this.documents = services.shared.workspace.LangiumDocuments;
    }

    override getScope(context: ReferenceInfo): Scope {
        const { index } = domainOf(context.container, this.documents);
        if (!index) return EMPTY_SCOPE;
        const candidates = candidatesFor(index, context);
        return candidates ? this.createScopeForNodes(candidates) : EMPTY_SCOPE;
    }
}

/** The nodes a reference may name, by the construct and property that holds it. */
export function candidatesFor(index: DomainAstIndex, context: ReferenceInfo): AstNode[] | undefined {
    const c = context.container;
    if (ast.isSynthPath(c) && context.property === 'root') return index.rowSources();
    if (ast.isSynthPathStep(c) && ast.isGivenColumn(c.$container) && (c.$containerIndex ?? 0) === 0) return index.membersOf(givenRowsOf(index, c.$container.$container));
    if (ast.isSynthPathStep(c)) return isMachineStep(c) ? index.machinesOf(previousOf(c)) : index.membersOf(previousOf(c));
    if (ast.isPopulationDecl(c)) {
        if (context.property === 'entity' || context.property === 'parent') return index.rowSources();
        if (context.property === 'clock') {
            const e = c.entity?.ref;
            return isRowSource(e) ? index.columnsOf(e) : [];
        }
    }
    if (ast.isGivenDecl(c)) return [...index.rowSources(), ...index.valueEnums()];
    if (ast.isShareEntry(c)) return index.enumAt(ast.isShareGroup(c.$container) ? c.$container.$container.dimension : c.$container.dimension)?.values ?? [];
    if (ast.isShareGroup(c)) return c.$container.given ? index.enumAt(c.$container.given)?.values ?? [] : [];
    if (ast.isRatePredicate(c)) return index.enumAt(c.path)?.values ?? [];
    if (ast.isMixEntry(c)) {
        const m = index.machineAt(c.$container.machine);
        return m ? index.statesOf(m) : [];
    }
    return undefined;
}
