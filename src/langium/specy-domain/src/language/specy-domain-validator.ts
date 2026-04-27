import type { ValidationAcceptor, ValidationChecks } from 'langium';
import type { SpecyDomainAstType, EntityDef, AggregateDef, EnumDef } from '../generated/ast.js';
import type { SpecyDomainServices } from './specy-domain-module.js';

/**
 * Register custom validation checks.
 */
export function registerValidationChecks(services: SpecyDomainServices): void {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.SpecyDomainValidator;
    const checks: ValidationChecks<SpecyDomainAstType> = {
        EntityDef: validator.checkEntityHasIdentity,
        AggregateDef: validator.checkAggregateHasRoot,
        EnumDef: validator.checkEnumHasValues,
    };
    registry.register(checks, validator);
}

/**
 * Semantic validation rules for the Specy Domain DSL.
 */
export class SpecyDomainValidator {
    checkEntityHasIdentity(entity: EntityDef, accept: ValidationAcceptor): void {
        const hasIdentity = entity.bodyItems.some(
            item => item.$type === 'IdentityDecl'
        );
        const hasIdField = entity.bodyItems.some(
            item => item.$type === 'FieldDecl' && item.name === 'id'
        );
        if (!hasIdentity && !hasIdField) {
            accept('warning', 'Entity should have an identity declaration or an "id" field.', {
                node: entity,
                property: 'name',
            });
        }
    }

    checkAggregateHasRoot(aggregate: AggregateDef, accept: ValidationAcceptor): void {
        const hasRoot = aggregate.bodyItems.some(
            item => item.$type === 'AggregateRootDecl'
        );
        if (!hasRoot) {
            accept('warning', 'Aggregate should have a "root" declaration.', {
                node: aggregate,
                property: 'name',
            });
        }
    }

    checkEnumHasValues(enumDef: EnumDef, accept: ValidationAcceptor): void {
        if (enumDef.values.length === 0) {
            accept('error', 'Enum must have at least one value.', {
                node: enumDef,
                property: 'name',
            });
        }
    }
}
