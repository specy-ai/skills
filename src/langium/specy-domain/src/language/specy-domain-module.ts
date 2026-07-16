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
    type PartialLangiumSharedServices,
} from 'langium/lsp';
import { SpecyDomainGeneratedModule, SpecyDomainGeneratedSharedModule } from '../generated/module.js';
import { SpecyDomainNodeKindProvider } from './specy-domain-node-kind-provider.js';
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

// =============================================================================
// LSP variant
//
// The services above are *core* (headless) — they are what the CLI in src/cli/
// uses, and they deliberately carry no LSP machinery. A language server needs
// the LSP service set instead: it is a superset of core, adding the providers
// that answer editor requests (document symbols, hover, completion, …).
//
// Both factories share one grammar, one generated module, and one validator, so
// the CLI and the editor can never disagree about what a .domain file means.
// =============================================================================

/**
 * Union of Langium LSP services and custom services.
 */
export type SpecyDomainLspServices = LangiumServices & SpecyDomainAddedServices;

/**
 * Custom module, typed against the LSP service set.
 */
export const SpecyDomainLspModule: Module<SpecyDomainLspServices, PartialLangiumServices & SpecyDomainAddedServices> = {
    validation: {
        SpecyDomainValidator: () => new SpecyDomainValidator(),
    },
};

/**
 * Shared-module overrides.
 *
 * NodeKindProvider is a *shared* service — one instance answers for every
 * language registered on the server — so it binds here rather than on the
 * language module above.
 */
export const SpecyDomainSharedLspModule: Module<LangiumSharedServices, PartialLangiumSharedServices> = {
    lsp: {
        NodeKindProvider: () => new SpecyDomainNodeKindProvider(),
    },
};

/**
 * Create the services required to run the Specy Domain language server.
 *
 * Document symbols come from Langium's DefaultDocumentSymbolProvider, which
 * builds its tree from the AST containment hierarchy and names each node via
 * the NameProvider — the grammar assigns `name=` on every construct that should
 * appear, so no custom provider is needed.
 */
export function createSpecyDomainLspServices(context: DefaultSharedModuleContext): {
    shared: LangiumSharedServices;
    SpecyDomain: SpecyDomainLspServices;
} {
    const shared = inject(
        createDefaultSharedModule(context),
        SpecyDomainGeneratedSharedModule,
        SpecyDomainSharedLspModule,
    );
    const SpecyDomain = inject(
        createDefaultModule({ shared }),
        SpecyDomainGeneratedModule,
        SpecyDomainLspModule,
    );
    shared.ServiceRegistry.register(SpecyDomain);
    registerValidationChecks(SpecyDomain);
    return { shared, SpecyDomain };
}
