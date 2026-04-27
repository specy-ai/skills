import {
    createDefaultCoreModule,
    createDefaultSharedCoreModule,
    type DefaultSharedCoreModuleContext,
    type LangiumCoreServices,
    type LangiumSharedCoreServices,
    type Module,
    type PartialLangiumCoreServices,
    inject,
} from 'langium';
import { SpecyDomainGeneratedModule, SpecyDomainGeneratedSharedModule } from '../generated/module.js';
import { SpecyDomainValidator, registerValidationChecks } from './specy-domain-validator.js';

/**
 * Declaration of custom services.
 */
export type SpecyDomainAddedServices = {
    validation: {
        SpecyDomainValidator: SpecyDomainValidator;
    };
};

/**
 * Union of Langium core services and custom services.
 */
export type SpecyDomainServices = LangiumCoreServices & SpecyDomainAddedServices;

/**
 * Custom module that adds our services.
 */
export const SpecyDomainModule: Module<SpecyDomainServices, PartialLangiumCoreServices & SpecyDomainAddedServices> = {
    validation: {
        SpecyDomainValidator: () => new SpecyDomainValidator(),
    },
};

/**
 * Create the full set of services required by the Specy Domain language.
 */
export function createSpecyDomainServices(context: DefaultSharedCoreModuleContext): {
    shared: LangiumSharedCoreServices;
    SpecyDomain: SpecyDomainServices;
} {
    const shared = inject(
        createDefaultSharedCoreModule(context),
        SpecyDomainGeneratedSharedModule,
    );
    const SpecyDomain = inject(
        createDefaultCoreModule({ shared }),
        SpecyDomainGeneratedModule,
        SpecyDomainModule,
    );
    shared.ServiceRegistry.register(SpecyDomain);
    registerValidationChecks(SpecyDomain);
    return { shared, SpecyDomain };
}
