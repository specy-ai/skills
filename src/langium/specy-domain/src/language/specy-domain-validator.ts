import type { AstNode, ValidationAcceptor, ValidationChecks } from 'langium';
import type {
    SpecyDomainAstType,
    AggregateDef,
    AgreementDef,
    EnumDef,
    EscalationChainDef,
    EventDef,
    InterfaceDef,
    ReadOnlyEntityDef,
    ValueDef,
} from '../generated/ast.js';
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
export function registerValidationChecks(services: SpecyDomainServices): void {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.SpecyDomainValidator;
    const checks: ValidationChecks<SpecyDomainAstType> = {
        AggregateDef: validator.checkAggregateIsNotItsOwnChild,
        AgreementDef: validator.checkAgreementParticipantsDiffer,
        EnumDef: validator.checkValueTypedEnumHasCodeField,
        EscalationChainDef: validator.checkEscalationChainTerminates,
        EventDef: validator.checkEventAboutEntityCarriesItsIdentifier,
        InterfaceDef: validator.checkInterfaceRoleConsistency,
        ReadOnlyEntityDef: validator.checkProjectedByRequiresProjection,
    };
    registry.register(checks, validator);
}

export class SpecyDomainValidator {
    /**
     * An escalation chain MUST terminate: `retry` and `compensate` can themselves
     * fail forever, so the last step's action must be alert / suspend / manual.
     *
     * The tree-sitter (GLR) grammar encodes this structurally as
     * `{ nonTerminalStep } terminalStep`. Langium is LL, and the two step shapes are
     * identical until the `action` keyword — arbitrarily far ahead — so the rule is
     * enforced here instead.
     */
    checkEscalationChainTerminates(chain: EscalationChainDef, accept: ValidationAcceptor): void {
        const last = chain.steps.at(-1);
        if (!last?.action) return;
        const kind = last.action.kind;
        if (kind === 'retry' || kind === 'compensate') {
            accept(
                'error',
                `An escalation chain must terminate, but its last step "${last.name}" is a "${kind}", which can ` +
                    'itself fail. End the chain with alert, suspend, or manual.',
                { node: last, property: 'name' },
            );
        }
    }

    /**
     * An `spi` interface describes exactly one provider — the infrastructure service
     * or repository that fulfils its contract. An `api` interface describes none: it
     * only selects operations that already exist on artefacts of its module.
     */
    checkInterfaceRoleConsistency(iface: InterfaceDef, accept: ValidationAcceptor): void {
        const describes = iface.members.filter(m => m.$type === 'DescribesClause');
        const exposes = iface.members.filter(m => m.$type === 'ExposesClause');

        if (iface.role === 'spi') {
            if (describes.length === 0) {
                accept(
                    'warning',
                    'An SPI is a driven port: it should name the infrastructure service or repository that fulfils ' +
                        'its contract, with `describes <Provider>`.',
                    { node: iface, property: 'name' },
                );
            }
            if (exposes.length > 0) {
                accept(
                    'error',
                    '`exposes` selects operations that already exist, which belongs to an API (a driving port). ' +
                        'An SPI defines its contract instead — declare the operation signatures directly.',
                    { node: iface, property: 'name' },
                );
            }
        } else if (iface.role === 'api' && describes.length > 0) {
            accept(
                'error',
                '`describes` names the provider of a driven port, which belongs to an SPI. An API publishes ' +
                    'operations its module already owns — use `exposes`.',
                { node: iface, property: 'name' },
            );
        }
    }

    /**
     * `projected-by` names the adapter that refreshes a local read-model, which only
     * exists when the entity is kept in sync by an asynchronous projection. A
     * synchronous lookup keeps no local copy, so there is nothing to project into.
     */
    checkProjectedByRequiresProjection(entity: ReadOnlyEntityDef, accept: ValidationAcceptor): void {
        if (entity.projectedBy && entity.syncedVia?.pattern !== 'asynchronous-projection') {
            accept(
                'error',
                '`projected-by` names the adapter maintaining a local read-model, so it is only meaningful with ' +
                    '`synced-via asynchronous-projection`. A synchronous lookup keeps no local copy.',
                { node: entity, property: 'name' },
            );
        }
    }

    /**
     * An event declared `about E` is a fact about an instance of E, so it must carry
     * a field referencing E's identifier — otherwise the fact cannot be tied back to
     * the thing it happened to.
     */
    checkEventAboutEntityCarriesItsIdentifier(event: EventDef, accept: ValidationAcceptor): void {
        if (!event.about) return;
        const entity = event.about.entity;
        const expected = `${entity.charAt(0).toLowerCase()}${entity.slice(1)}Id`;
        const carriesId = event.fields.fields.some(f => f.name.toLowerCase().endsWith('id'));
        if (!carriesId) {
            accept(
                'warning',
                `Event "${event.name}" is about ${entity} but carries no field referencing its identifier ` +
                    `(expected something like \`${expected}\`). The fact cannot be correlated back to the ` +
                    `${entity} it happened to.`,
                { node: event, property: 'name' },
            );
        }
    }

    /**
     * An enum declared `of V` references the instances of value type V by a code, so
     * V must declare exactly one `code` field.
     */
    checkValueTypedEnumHasCodeField(enumDef: EnumDef, accept: ValidationAcceptor): void {
        if (!enumDef.valueType) return;
        const valueType = findValueDef(enumDef, enumDef.valueType);
        if (!valueType) return; // unresolved type — not this check's business
        const codeFields = valueType.fields.fields.filter(f =>
            f.constraints.some(c => c.kind === 'code'),
        );
        if (codeFields.length !== 1) {
            accept(
                codeFields.length === 0 ? 'error' : 'warning',
                `Enum "${enumDef.name}" holds instances of ${enumDef.valueType}, which must declare exactly one ` +
                    `\`code\` field to reference them by (found ${codeFields.length}).`,
                { node: enumDef, property: 'name' },
            );
        }
    }

    /** An aggregate IS its root, so it cannot also list itself as a child entity. */
    checkAggregateIsNotItsOwnChild(aggregate: AggregateDef, accept: ValidationAcceptor): void {
        if (aggregate.entities.entities.includes(aggregate.name)) {
            accept(
                'error',
                `An aggregate is its own root, so "${aggregate.name}" must not appear in its own \`entities\` ` +
                    'list — that block names the non-root children of the cluster.',
                { node: aggregate, property: 'name' },
            );
        }
    }

    /** An agreement spans distinct aggregates — a truth about one of them is an invariant. */
    checkAgreementParticipantsDiffer(agreement: AgreementDef, accept: ValidationAcceptor): void {
        const distinct = new Set(agreement.participants.participants);
        if (distinct.size < 2) {
            accept(
                'error',
                `Agreement "${agreement.name}" must span at least two DISTINCT aggregates. A property of a single ` +
                    'aggregate is an invariant, which is enforced atomically instead of reconciled.',
                { node: agreement, property: 'name' },
            );
        }
    }
}

/** Find a ValueDef by name anywhere in the same document. */
function findValueDef(from: EnumDef, name: string): ValueDef | undefined {
    let root: AstNode | undefined = from;
    while (root?.$container) root = root.$container;

    let found: ValueDef | undefined;
    const walk = (node: unknown): void => {
        if (found || !node || typeof node !== 'object') return;
        const n = node as Record<string, unknown> & { $type?: string; name?: string };
        if (n.$type === 'ValueDef' && n.name === name) {
            found = node as ValueDef;
            return;
        }
        for (const [key, value] of Object.entries(n)) {
            if (key.startsWith('$')) continue;
            if (Array.isArray(value)) value.forEach(walk);
            else if (value && typeof value === 'object') walk(value);
        }
    };
    walk(root);
    return found;
}
