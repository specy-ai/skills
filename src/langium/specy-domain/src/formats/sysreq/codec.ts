/**
 * The .sysreq codec: the four encodings of a requirements document, on the
 * parser, normalizer and printers of this package.
 */
import type { ReqFile } from '../../generated/ast.js';
import { SYSREQ_SCHEMA } from '../../cli/version.js';
import type { ModelCodec, ParseContext, ParseResult } from '../kit/codec.js';
import { parseText } from '../kit/parse.js';
import { SCHEMAS } from '../generated/schemas.js';
import { sysreqFromMarkdown, sysreqToMarkdown } from './markdown.js';
import { normalizeSysreq, type SysreqDocument } from './model.js';
import { printSysreq } from './printer.js';

export type { SysreqDocument } from './model.js';

export async function parseSysreqText(text: string, ctx: ParseContext): Promise<ParseResult<SysreqDocument>> {
    const r = await parseText<ReqFile>(ctx.fileName, text, ctx);
    return { model: normalizeSysreq(r.ast), diagnostics: r.diagnostics, ok: !r.diagnostics.some(d => d.severity === 'error') };
}

export const sysreqCodec: ModelCodec<SysreqDocument> = {
    language: 'sysreq',
    extension: '.sysreq',
    schemaId: SYSREQ_SCHEMA,
    schema: () => SCHEMAS.sysreq,
    parse: parseSysreqText,
    print: printSysreq,
    toMarkdown: sysreqToMarkdown,
    fromMarkdown: markdown => sysreqFromMarkdown(markdown),
};
