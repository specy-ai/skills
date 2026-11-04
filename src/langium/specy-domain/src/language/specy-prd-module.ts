/**
 * Services of the .prd language. The grammar is specy-prd.langium; the
 * semantic rules (ids unique, references by name resolving within the product)
 * belong in a validator registered here. Wired into the shared service set by
 * specy-module.ts.
 */
import type { LangiumCoreServices, Module, PartialLangiumCoreServices } from 'langium';

export type SpecyPrdAddedServices = Record<string, never>;

export type SpecyPrdServices = LangiumCoreServices & SpecyPrdAddedServices;

export const SpecyPrdModule: Module<SpecyPrdServices, PartialLangiumCoreServices & SpecyPrdAddedServices> = {};

export function registerPrdValidationChecks(_services: SpecyPrdServices): void {
    // No semantic checks yet: the grammar carries the structure.
}
