import { type DefaultSharedCoreModuleContext, type LangiumCoreServices, type LangiumSharedCoreServices, type Module, type PartialLangiumCoreServices } from 'langium';
import { SpecyDomainValidator } from './specy-domain-validator.js';
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
export declare const SpecyDomainModule: Module<SpecyDomainServices, PartialLangiumCoreServices & SpecyDomainAddedServices>;
/**
 * Create the full set of services required by the Specy Domain language.
 */
export declare function createSpecyDomainServices(context: DefaultSharedCoreModuleContext): {
    shared: LangiumSharedCoreServices;
    SpecyDomain: SpecyDomainServices;
};
