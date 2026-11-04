/**
 * Services of the .arch language. The grammar is specy-architecture.langium;
 * the validation rules the metamodel states (one root per file, at most one
 * requirements-source, a system detailed inline or by detailed-in, flow numbers
 * unique, phases declared, one pattern per side) live in
 * specy-architecture-validator.ts. Wired into the shared service set by
 * specy-module.ts.
 */
import type { LangiumCoreServices, Module, PartialLangiumCoreServices } from 'langium';
import { SpecyArchitectureValidator, registerArchitectureValidationChecks as registerChecks } from './specy-architecture-validator.js';

export type SpecyArchitectureAddedServices = {
    validation: {
        SpecyArchitectureValidator: SpecyArchitectureValidator;
    };
};

export type SpecyArchitectureServices = LangiumCoreServices & SpecyArchitectureAddedServices;

export const SpecyArchitectureModule: Module<SpecyArchitectureServices, PartialLangiumCoreServices & SpecyArchitectureAddedServices> = {
    validation: {
        SpecyArchitectureValidator: () => new SpecyArchitectureValidator(),
    },
};

export function registerArchitectureValidationChecks(services: SpecyArchitectureServices): void {
    registerChecks(services);
}
