import type { DomainModel } from './domain-model.js';
/**
 * Render a normalized {@link DomainModel} as documentation-style Markdown:
 * `#` organization → `##` context → `###` module → `####` construct, with
 * field tables and inline description / satisfies lines.
 */
export declare function modelToMarkdown(model: DomainModel): string;
