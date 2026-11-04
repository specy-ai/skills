/**
 * The .arch codec: the four encodings of a software-architecture model, on the
 * parser, normalizer and printers of this package.
 */
import type { ArchFile } from '../../generated/ast.js';
import { ARCHITECTURE_SCHEMA } from '../../cli/version.js';
import type { ModelCodec, ParseContext, ParseResult } from '../kit/codec.js';
import { parseText } from '../kit/parse.js';
import { SCHEMAS } from '../generated/schemas.js';
import { architectureFromMarkdown, architectureToMarkdown } from './markdown.js';
import { normalizeArchitecture, type ArchitectureDocument } from './model.js';
import { printArchitecture } from './printer.js';

export type { ArchitectureDocument } from './model.js';

export async function parseArchitectureText(text: string, ctx: ParseContext): Promise<ParseResult<ArchitectureDocument>> {
    const r = await parseText<ArchFile>(ctx.fileName, text, ctx);
    return { model: normalizeArchitecture(r.ast), diagnostics: r.diagnostics, ok: !r.diagnostics.some(d => d.severity === 'error') };
}

export const architectureCodec: ModelCodec<ArchitectureDocument> = {
    language: 'architecture',
    extension: '.arch',
    schemaId: ARCHITECTURE_SCHEMA,
    schema: () => SCHEMAS.architecture,
    parse: parseArchitectureText,
    print: printArchitecture,
    toMarkdown: architectureToMarkdown,
    fromMarkdown: markdown => architectureFromMarkdown(markdown),
};
