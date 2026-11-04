/**
 * Services for the .synth language.
 *
 * One shared set matters: a .synth file resolves its references into a .domain
 * document, so the two languages must see the same LangiumDocuments and the same
 * DocumentBuilder. The factories that build that set for every Specy language
 * (`createSpecyServices` / `createSpecyLspServices`) live in specy-module.ts;
 * this file only declares what the .synth language adds.
 */
import type { LangiumCoreServices, Module, PartialLangiumCoreServices } from 'langium';
import type { LangiumServices, PartialLangiumServices } from 'langium/lsp';
import { SpecySynthCompletionProvider } from './specy-synth-completion.js';
import { SpecySynthLinker } from './specy-synth-linker.js';
import { SpecySynthScopeProvider } from './specy-synth-scope.js';
import { SpecySynthDocumentValidator, SpecySynthValidator } from './specy-synth-validator.js';

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
    lsp: {
        CompletionProvider: services => new SpecySynthCompletionProvider(services),
    },
    validation: {
        DocumentValidator: services => new SpecySynthDocumentValidator(services),
        SpecySynthValidator: () => new SpecySynthValidator(),
    },
};
