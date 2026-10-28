/**
 * Services for the .synth language, and the factories that run BOTH Specy
 * languages on one shared service set.
 *
 * One shared set matters: a .synth file resolves its references into a .domain
 * document, so the two languages must see the same LangiumDocuments and the same
 * DocumentBuilder. The CLI (`specy-synth`), the browser bundle and the language
 * server all go through `createSpecyServices` / `createSpecyLspServices`; the
 * domain-only factories in specy-domain-module.ts remain for `specy-domain`.
 */
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
import {
    createDefaultModule,
    createDefaultSharedModule,
    type DefaultSharedModuleContext,
    type LangiumServices,
    type LangiumSharedServices,
    type PartialLangiumServices,
} from 'langium/lsp';
import { SpecyDomainGeneratedModule, SpecyDomainGeneratedSharedModule, SpecySynthGeneratedModule } from '../generated/module.js';
import {
    SpecyDomainLspModule,
    SpecyDomainModule,
    SpecyDomainSharedLspModule,
    type SpecyDomainLspServices,
    type SpecyDomainServices,
} from './specy-domain-module.js';
import { registerValidationChecks as registerDomainChecks } from './specy-domain-validator.js';
import { SpecySynthLinker } from './specy-synth-linker.js';
import { SpecySynthScopeProvider } from './specy-synth-scope.js';
import { SpecySynthDocumentValidator, SpecySynthValidator, registerSynthValidationChecks } from './specy-synth-validator.js';

export type SpecySynthAddedServices = {
    validation: {
        SpecySynthValidator: SpecySynthValidator;
    };
};

export type SpecySynthServices = LangiumCoreServices & SpecySynthAddedServices;
export type SpecySynthLspServices = LangiumServices & SpecySynthAddedServices;

export const SpecySynthModule: Module<SpecySynthServices, PartialLangiumCoreServices & SpecySynthAddedServices> = {
    references: {
        ScopeProvider: services => new SpecySynthScopeProvider(services),
        Linker: services => new SpecySynthLinker(services),
    },
    validation: {
        DocumentValidator: services => new SpecySynthDocumentValidator(services),
        SpecySynthValidator: () => new SpecySynthValidator(),
    },
};

export const SpecySynthLspModule: Module<SpecySynthLspServices, PartialLangiumServices & SpecySynthAddedServices> = {
    references: {
        ScopeProvider: services => new SpecySynthScopeProvider(services),
        Linker: services => new SpecySynthLinker(services),
    },
    validation: {
        DocumentValidator: services => new SpecySynthDocumentValidator(services),
        SpecySynthValidator: () => new SpecySynthValidator(),
    },
};

/** Headless services for both languages: the CLIs, the tests, the browser bundle. */
export function createSpecyServices(context: DefaultSharedCoreModuleContext): {
    shared: LangiumSharedCoreServices;
    SpecyDomain: SpecyDomainServices;
    SpecySynth: SpecySynthServices;
} {
    const shared = inject(createDefaultSharedCoreModule(context), SpecyDomainGeneratedSharedModule);
    const SpecyDomain = inject(createDefaultCoreModule({ shared }), SpecyDomainGeneratedModule, SpecyDomainModule);
    const SpecySynth = inject(createDefaultCoreModule({ shared }), SpecySynthGeneratedModule, SpecySynthModule);
    shared.ServiceRegistry.register(SpecyDomain);
    shared.ServiceRegistry.register(SpecySynth);
    registerDomainChecks(SpecyDomain);
    registerSynthValidationChecks(SpecySynth);
    return { shared, SpecyDomain, SpecySynth };
}

/** The language server: both languages, one connection. */
export function createSpecyLspServices(context: DefaultSharedModuleContext): {
    shared: LangiumSharedServices;
    SpecyDomain: SpecyDomainLspServices;
    SpecySynth: SpecySynthLspServices;
} {
    const shared = inject(createDefaultSharedModule(context), SpecyDomainGeneratedSharedModule, SpecyDomainSharedLspModule);
    const SpecyDomain = inject(createDefaultModule({ shared }), SpecyDomainGeneratedModule, SpecyDomainLspModule);
    const SpecySynth = inject(createDefaultModule({ shared }), SpecySynthGeneratedModule, SpecySynthLspModule);
    shared.ServiceRegistry.register(SpecyDomain);
    shared.ServiceRegistry.register(SpecySynth);
    registerDomainChecks(SpecyDomain);
    registerSynthValidationChecks(SpecySynth);
    return { shared, SpecyDomain, SpecySynth };
}
