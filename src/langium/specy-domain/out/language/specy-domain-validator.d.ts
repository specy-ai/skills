import type { ValidationAcceptor } from 'langium';
import type { EntityDef, AggregateDef, EnumDef } from '../generated/ast.js';
import type { SpecyDomainServices } from './specy-domain-module.js';
/**
 * Register custom validation checks.
 */
export declare function registerValidationChecks(services: SpecyDomainServices): void;
/**
 * Semantic validation rules for the Specy Domain DSL.
 */
export declare class SpecyDomainValidator {
    checkEntityHasIdentity(entity: EntityDef, accept: ValidationAcceptor): void;
    checkAggregateHasRoot(aggregate: AggregateDef, accept: ValidationAcceptor): void;
    checkEnumHasValues(enumDef: EnumDef, accept: ValidationAcceptor): void;
}
