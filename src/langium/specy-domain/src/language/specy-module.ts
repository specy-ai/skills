/**
 * The five Specy languages on one shared service set.
 *
 * One shared set matters: a .synth file resolves its references into a .domain
 * document, and a .arch or .sysreq file will name its sources the same way, so
 * every language must see the same LangiumDocuments and the same
 * DocumentBuilder. The CLIs (`specy`, `specy-domain`, `specy-synth`), the
 * browser bundle, the tests and the language server all go through
 * `createSpecyServices` / `createSpecyLspServices`; the domain-only factories in
 * specy-domain-module.ts remain for callers that want nothing else.
 */
import {
    createDefaultCoreModule,
    createDefaultSharedCoreModule,
    type DefaultSharedCoreModuleContext,
    type LangiumCoreServices,
    type LangiumSharedCoreServices,
    inject,
} from 'langium';
import {
    createDefaultModule,
    createDefaultSharedModule,
    type DefaultSharedModuleContext,
    type LangiumServices,
    type LangiumSharedServices,
} from 'langium/lsp';
import {
    SpecyArchitectureGeneratedModule,
    SpecyDomainGeneratedModule,
    SpecyDomainGeneratedSharedModule,
    SpecyPrdGeneratedModule,
    SpecySynthGeneratedModule,
    SpecySysreqGeneratedModule,
} from '../generated/module.js';
import {
    SpecyDomainLspModule,
    SpecyDomainModule,
    SpecyDomainSharedLspModule,
    type SpecyDomainLspServices,
    type SpecyDomainServices,
} from './specy-domain-module.js';
import { registerValidationChecks as registerDomainChecks } from './specy-domain-validator.js';
import { SpecySynthLspModule, SpecySynthModule, type SpecySynthLspServices, type SpecySynthServices } from './specy-synth-module.js';
import { registerSynthValidationChecks } from './specy-synth-validator.js';
import { SpecyPrdModule, registerPrdValidationChecks, type SpecyPrdServices } from './specy-prd-module.js';
import { SpecySysreqModule, registerSysreqValidationChecks, type SpecySysreqServices } from './specy-sysreq-module.js';
import { SpecyArchitectureModule, registerArchitectureValidationChecks, type SpecyArchitectureServices } from './specy-architecture-module.js';

export interface SpecyServices {
    shared: LangiumSharedCoreServices;
    SpecyDomain: SpecyDomainServices;
    SpecySynth: SpecySynthServices;
    SpecyPrd: SpecyPrdServices;
    SpecySysreq: SpecySysreqServices;
    SpecyArchitecture: SpecyArchitectureServices;
}

/** Headless services for the five languages: the CLIs, the tests, the browser bundle. */
export function createSpecyServices(context: DefaultSharedCoreModuleContext): SpecyServices {
    const shared = inject(createDefaultSharedCoreModule(context), SpecyDomainGeneratedSharedModule);
    const SpecyDomain = inject(createDefaultCoreModule({ shared }), SpecyDomainGeneratedModule, SpecyDomainModule);
    const SpecySynth = inject(createDefaultCoreModule({ shared }), SpecySynthGeneratedModule, SpecySynthModule);
    const SpecyPrd = inject(createDefaultCoreModule({ shared }), SpecyPrdGeneratedModule, SpecyPrdModule);
    const SpecySysreq = inject(createDefaultCoreModule({ shared }), SpecySysreqGeneratedModule, SpecySysreqModule);
    const SpecyArchitecture = inject(createDefaultCoreModule({ shared }), SpecyArchitectureGeneratedModule, SpecyArchitectureModule);
    for (const s of [SpecyDomain, SpecySynth, SpecyPrd, SpecySysreq, SpecyArchitecture] as LangiumCoreServices[]) {
        shared.ServiceRegistry.register(s);
    }
    registerDomainChecks(SpecyDomain);
    registerSynthValidationChecks(SpecySynth);
    registerPrdValidationChecks(SpecyPrd);
    registerSysreqValidationChecks(SpecySysreq);
    registerArchitectureValidationChecks(SpecyArchitecture);
    return { shared, SpecyDomain, SpecySynth, SpecyPrd, SpecySysreq, SpecyArchitecture };
}

export interface SpecyLspServices {
    shared: LangiumSharedServices;
    SpecyDomain: SpecyDomainLspServices;
    SpecySynth: SpecySynthLspServices;
    SpecyPrd: LangiumServices;
    SpecySysreq: LangiumServices;
    SpecyArchitecture: LangiumServices;
}

/** The language server: five languages, one connection. */
export function createSpecyLspServices(context: DefaultSharedModuleContext): SpecyLspServices {
    const shared = inject(createDefaultSharedModule(context), SpecyDomainGeneratedSharedModule, SpecyDomainSharedLspModule);
    const SpecyDomain = inject(createDefaultModule({ shared }), SpecyDomainGeneratedModule, SpecyDomainLspModule);
    const SpecySynth = inject(createDefaultModule({ shared }), SpecySynthGeneratedModule, SpecySynthLspModule);
    const SpecyPrd = inject(createDefaultModule({ shared }), SpecyPrdGeneratedModule, SpecyPrdModule);
    const SpecySysreq = inject(createDefaultModule({ shared }), SpecySysreqGeneratedModule, SpecySysreqModule);
    const SpecyArchitecture = inject(createDefaultModule({ shared }), SpecyArchitectureGeneratedModule, SpecyArchitectureModule);
    for (const s of [SpecyDomain, SpecySynth, SpecyPrd, SpecySysreq, SpecyArchitecture] as LangiumServices[]) {
        shared.ServiceRegistry.register(s);
    }
    registerDomainChecks(SpecyDomain);
    registerSynthValidationChecks(SpecySynth);
    registerPrdValidationChecks(SpecyPrd);
    registerSysreqValidationChecks(SpecySysreq);
    registerArchitectureValidationChecks(SpecyArchitecture);
    return { shared, SpecyDomain, SpecySynth, SpecyPrd, SpecySysreq, SpecyArchitecture };
}
