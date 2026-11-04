/**
 * The .domain codec: the four encodings of a domain model, on the parser,
 * normalizer and printers of this package.
 */
import type { DomainFile } from '../../generated/ast.js';
import { normalizeDomain, type DomainModel } from '../../cli/domain-model.js';
import { DOMAIN_MODEL_SCHEMA } from '../../cli/version.js';
import type { ModelCodec, ParseContext, ParseResult } from '../kit/codec.js';
import { parseText } from '../kit/parse.js';
import { SCHEMAS } from '../generated/schemas.js';
import { domainFromMarkdown, domainToMarkdown } from './markdown.js';
import { printDomain } from './printer.js';

export async function parseDomainText(text: string, ctx: ParseContext): Promise<ParseResult<DomainModel>> {
    const r = await parseText<DomainFile>(ctx.fileName, text, ctx);
    return { model: normalizeDomain(r.ast), diagnostics: r.diagnostics, ok: !r.diagnostics.some(d => d.severity === 'error') };
}

export const domainCodec: ModelCodec<DomainModel> = {
    language: 'domain',
    extension: '.domain',
    schemaId: DOMAIN_MODEL_SCHEMA,
    schema: () => SCHEMAS.domain,
    parse: parseDomainText,
    print: printDomain,
    toMarkdown: domainToMarkdown,
    fromMarkdown: markdown => domainFromMarkdown(markdown),
};
