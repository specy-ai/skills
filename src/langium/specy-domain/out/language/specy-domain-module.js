import { createDefaultCoreModule, createDefaultSharedCoreModule, inject, } from 'langium';
import { SpecyDomainGeneratedModule, SpecyDomainGeneratedSharedModule } from '../generated/module.js';
import { SpecyDomainValidator, registerValidationChecks } from './specy-domain-validator.js';
/**
 * Custom module that adds our services.
 */
export const SpecyDomainModule = {
    validation: {
        SpecyDomainValidator: () => new SpecyDomainValidator(),
    },
};
/**
 * Create the full set of services required by the Specy Domain language.
 */
export function createSpecyDomainServices(context) {
    const shared = inject(createDefaultSharedCoreModule(context), SpecyDomainGeneratedSharedModule);
    const SpecyDomain = inject(createDefaultCoreModule({ shared }), SpecyDomainGeneratedModule, SpecyDomainModule);
    shared.ServiceRegistry.register(SpecyDomain);
    registerValidationChecks(SpecyDomain);
    return { shared, SpecyDomain };
}
//# sourceMappingURL=specy-domain-module.js.map