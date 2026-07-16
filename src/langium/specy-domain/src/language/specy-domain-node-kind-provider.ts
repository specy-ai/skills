/**
 * Maps Specy Domain AST nodes to LSP symbol kinds.
 *
 * Langium's DefaultNodeKindProvider answers SymbolKind.Field for every node, so
 * an outline of a .domain file arrives as a flat wall of identical icons — an
 * entity, an enum and an invariant all look the same, and the kind filter in a
 * symbol picker has nothing to bite on. This provider gives each construct the
 * kind an editor already knows how to draw.
 *
 * The mapping is by intent rather than by literal correspondence — LSP's kinds
 * come from general-purpose languages and there is no `Aggregate`. What matters
 * is that constructs a modeller distinguishes get icons a reader can tell apart:
 * behaviour (Method/Function) reads differently from structure (Class/Struct),
 * and facts (Event) differently from rules (Property).
 */
import type { AstNode, AstNodeDescription } from 'langium';
import { DefaultNodeKindProvider } from 'langium/lsp';
import { CompletionItemKind, SymbolKind } from 'vscode-languageserver';

const SYMBOL_KINDS: Record<string, SymbolKind> = {
    // ── Containers ───────────────────────────────────────────────────────
    OrganizationDef: SymbolKind.Namespace,
    ContextDef: SymbolKind.Namespace,
    ModuleDef: SymbolKind.Module,

    // ── Structure ────────────────────────────────────────────────────────
    // An aggregate IS its root entity, so both read as Class.
    EntityDef: SymbolKind.Class,
    AggregateDef: SymbolKind.Class,
    ReadOnlyEntityDef: SymbolKind.Class,
    // A value type is immutable and identity-less — Struct carries exactly that.
    ValueDef: SymbolKind.Struct,
    EnumDef: SymbolKind.Enum,
    EnumValue: SymbolKind.EnumMember,
    FieldDecl: SymbolKind.Field,

    // ── Behaviour ────────────────────────────────────────────────────────
    SafeOpDef: SymbolKind.Method,
    ValueOpDef: SymbolKind.Method,
    CommandDef: SymbolKind.Function,
    QueryDef: SymbolKind.Function,
    ReactionDef: SymbolKind.Function,

    // ── Facts ────────────────────────────────────────────────────────────
    EventDef: SymbolKind.Event,
    ExternalEventDef: SymbolKind.Event,
    ErrorEventDef: SymbolKind.Event,
    TemporalEventDef: SymbolKind.Event,

    // ── Rules ────────────────────────────────────────────────────────────
    InvariantDef: SymbolKind.Property,
    ScopedInvariantDef: SymbolKind.Property,
    AgreementDef: SymbolKind.Property,
    ReconciliationDef: SymbolKind.Property,
    EscalationChainDef: SymbolKind.Property,

    // ── Lifecycle ────────────────────────────────────────────────────────
    StateMachineDef: SymbolKind.Enum,
    StateDef: SymbolKind.EnumMember,
    TransitionDef: SymbolKind.Operator,

    // ── Ports and adapters ───────────────────────────────────────────────
    InterfaceDef: SymbolKind.Interface,
    RepositoryDef: SymbolKind.Interface,
    DomainServiceDef: SymbolKind.Class,
    ApplicationServiceDef: SymbolKind.Class,
    InfrastructureServiceDef: SymbolKind.Class,
};

const COMPLETION_KINDS: Record<string, CompletionItemKind> = {
    EntityDef: CompletionItemKind.Class,
    AggregateDef: CompletionItemKind.Class,
    ReadOnlyEntityDef: CompletionItemKind.Class,
    ValueDef: CompletionItemKind.Struct,
    EnumDef: CompletionItemKind.Enum,
    EnumValue: CompletionItemKind.EnumMember,
    FieldDecl: CompletionItemKind.Field,
    CommandDef: CompletionItemKind.Function,
    QueryDef: CompletionItemKind.Function,
    ReactionDef: CompletionItemKind.Function,
    EventDef: CompletionItemKind.Event,
    ExternalEventDef: CompletionItemKind.Event,
    ErrorEventDef: CompletionItemKind.Event,
    TemporalEventDef: CompletionItemKind.Event,
    SafeOpDef: CompletionItemKind.Method,
    ValueOpDef: CompletionItemKind.Method,
    InterfaceDef: CompletionItemKind.Interface,
    RepositoryDef: CompletionItemKind.Interface,
};

/** The `$type` of an AST node, or of a node description from the index. */
function typeOf(node: AstNode | AstNodeDescription): string {
    return '$type' in node ? node.$type : node.type;
}

export class SpecyDomainNodeKindProvider extends DefaultNodeKindProvider {
    override getSymbolKind(node: AstNode | AstNodeDescription): SymbolKind {
        return SYMBOL_KINDS[typeOf(node)] ?? SymbolKind.Field;
    }

    override getCompletionItemKind(node: AstNode | AstNodeDescription): CompletionItemKind {
        return COMPLETION_KINDS[typeOf(node)] ?? CompletionItemKind.Reference;
    }
}
