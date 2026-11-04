/**
 * The .prd codec: the four encodings of a product requirements document, on
 * the parser, normalizer and printers of this package.
 */
import type { PrdFile } from '../../generated/ast.js';
import { PRD_SCHEMA } from '../../cli/version.js';
import type { ModelCodec, ParseContext, ParseResult } from '../kit/codec.js';
import { parseText } from '../kit/parse.js';
import { SCHEMAS } from '../generated/schemas.js';
import { normalizePrd, type PrdDocument } from './model.js';
import { prdFromMarkdown, prdToMarkdown } from './markdown.js';
import { printPrd } from './printer.js';

export type { PrdDocument } from './model.js';

export async function parsePrdText(text: string, ctx: ParseContext): Promise<ParseResult<PrdDocument>> {
    const r = await parseText<PrdFile>(ctx.fileName, text, ctx);
    return { model: normalizePrd(r.ast), diagnostics: r.diagnostics, ok: !r.diagnostics.some(d => d.severity === 'error') };
}

export const prdCodec: ModelCodec<PrdDocument> = {
    language: 'prd',
    extension: '.prd',
    schemaId: PRD_SCHEMA,
    schema: () => SCHEMAS.prd,
    parse: parsePrdText,
    print: printPrd,
    toMarkdown: prdToMarkdown,
    fromMarkdown: markdown => prdFromMarkdown(markdown),
};
