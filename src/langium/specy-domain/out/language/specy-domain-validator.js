/**
 * Register custom validation checks.
 */
export function registerValidationChecks(services) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.SpecyDomainValidator;
    const checks = {
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
    checkEntityHasIdentity(entity, accept) {
        const hasIdentity = entity.bodyItems.some(item => item.$type === 'IdentityDecl');
        const hasIdField = entity.bodyItems.some(item => item.$type === 'FieldDecl' && item.name === 'id');
        if (!hasIdentity && !hasIdField) {
            accept('warning', 'Entity should have an identity declaration or an "id" field.', {
                node: entity,
                property: 'name',
            });
        }
    }
    checkAggregateHasRoot(aggregate, accept) {
        const hasRoot = aggregate.bodyItems.some(item => item.$type === 'AggregateRootDecl');
        if (!hasRoot) {
            accept('warning', 'Aggregate should have a "root" declaration.', {
                node: aggregate,
                property: 'name',
            });
        }
    }
    checkEnumHasValues(enumDef, accept) {
        if (enumDef.values.length === 0) {
            accept('error', 'Enum must have at least one value.', {
                node: enumDef,
                property: 'name',
            });
        }
    }
}
//# sourceMappingURL=specy-domain-validator.js.map