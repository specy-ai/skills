import type { ValidationAcceptor } from 'langium';
import type { AggregateDef, AgreementDef, EnumDef, EscalationChainDef, EventDef, InterfaceDef, ReadOnlyEntityDef } from '../generated/ast.js';
import type { SpecyDomainServices } from './specy-domain-module.js';
/**
 * Semantic rules of the domain metamodel that a context-free grammar cannot express.
 *
 * Everything the grammar CAN enforce is enforced there and is deliberately absent
 * here: an entity has an identity, an enum has values, a command carries a
 * correlation id, a read-only entity performs no mutation, an event never reaches a
 * command except through a reaction.
 *
 * See the "Semantic rules" block at the foot of src/grammars/domain.ebnf.
 */
export declare function registerValidationChecks(services: SpecyDomainServices): void;
export declare class SpecyDomainValidator {
    /**
     * An escalation chain MUST terminate: `retry` and `compensate` can themselves
     * fail forever, so the last step's action must be alert / suspend / manual.
     *
     * The tree-sitter (GLR) grammar encodes this structurally as
     * `{ nonTerminalStep } terminalStep`. Langium is LL, and the two step shapes are
     * identical until the `action` keyword — arbitrarily far ahead — so the rule is
     * enforced here instead.
     */
    checkEscalationChainTerminates(chain: EscalationChainDef, accept: ValidationAcceptor): void;
    /**
     * An `spi` interface describes exactly one provider — the infrastructure service
     * or repository that fulfils its contract. An `api` interface describes none: it
     * only selects operations that already exist on artefacts of its module.
     */
    checkInterfaceRoleConsistency(iface: InterfaceDef, accept: ValidationAcceptor): void;
    /**
     * `projected-by` names the adapter that refreshes a local read-model, which only
     * exists when the entity is kept in sync by an asynchronous projection. A
     * synchronous lookup keeps no local copy, so there is nothing to project into.
     */
    checkProjectedByRequiresProjection(entity: ReadOnlyEntityDef, accept: ValidationAcceptor): void;
    /**
     * An event declared `about E` is a fact about an instance of E, so it must carry
     * a field referencing E's identifier — otherwise the fact cannot be tied back to
     * the thing it happened to.
     */
    checkEventAboutEntityCarriesItsIdentifier(event: EventDef, accept: ValidationAcceptor): void;
    /**
     * An enum declared `of V` references the instances of value type V by a code, so
     * V must declare exactly one `code` field.
     */
    checkValueTypedEnumHasCodeField(enumDef: EnumDef, accept: ValidationAcceptor): void;
    /** An aggregate IS its root, so it cannot also list itself as a child entity. */
    checkAggregateIsNotItsOwnChild(aggregate: AggregateDef, accept: ValidationAcceptor): void;
    /** An agreement spans distinct aggregates — a truth about one of them is an invariant. */
    checkAgreementParticipantsDiffer(agreement: AgreementDef, accept: ValidationAcceptor): void;
}
