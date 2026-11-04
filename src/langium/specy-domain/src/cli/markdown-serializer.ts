/**
 * `specy-domain parse -f markdown` writes the canonical Markdown of the model
 * formats (src/metamodels/MODEL-FORMATS.md) — the document `specy convert`
 * reads back. Kept under its historical name for the CLI; the writer lives
 * with the reader in src/formats/domain/markdown.ts.
 */
export { domainToMarkdown as modelToMarkdown } from '../formats/domain/markdown.js';
