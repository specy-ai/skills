/**
 * Services of the .sysreq language. The grammar is specy-sysreq.langium; the
 * semantic rules (ids unique in the file, references declared) live in
 * specy-sysreq-validator.ts. Wired into the shared service set by
 * specy-module.ts.
 */
import type { LangiumCoreServices, Module, PartialLangiumCoreServices } from 'langium';
import { SpecySysreqValidator, registerSysreqValidationChecks as registerChecks } from './specy-sysreq-validator.js';

export type SpecySysreqAddedServices = {
    validation: {
        SpecySysreqValidator: SpecySysreqValidator;
    };
};

export type SpecySysreqServices = LangiumCoreServices & SpecySysreqAddedServices;

export const SpecySysreqModule: Module<SpecySysreqServices, PartialLangiumCoreServices & SpecySysreqAddedServices> = {
    validation: {
        SpecySysreqValidator: () => new SpecySysreqValidator(),
    },
};

export function registerSysreqValidationChecks(services: SpecySysreqServices): void {
    registerChecks(services);
}
