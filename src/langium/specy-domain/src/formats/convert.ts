/**
 * The conversion pipeline: any encoding of a Specy model to any other.
 *
 *   input ──► model ──► output
 *
 * Reading:
 *   dsl       parse
 *   json/yaml decode, validate against the schema, print to DSL, parse
 *   markdown  transpile to DSL (the language's reader), parse, map lines back
 *
 * Writing:
 *   dsl       print          json/yaml  serialize          markdown  toMarkdown
 *
 * Every non-DSL input is parsed after all, so one grammar, one validator and
 * one set of cross-reference rules judge a document whatever it was written in,
 * and the model that comes out is the canonical one (fresh `parser` header,
 * definitions grouped as the normalizer groups them). The diagnostics name the
 * stage that raised them and, for Markdown, the Markdown line.
 */
import { parse as parseYaml, stringify as yamlStringify } from 'yaml';
import {
    codecFor,
    normalizeFormat,
    normalizeLanguage,
    type Diagnostic,
    type Format,
    type Language,
    type ModelCodec,
    type ParseContext,
} from './kit/codec.js';
import { detectFormatFromText, detectFromFileName, detectLanguageFromDocument } from './kit/detect.js';
import { parseFrontMatter } from './kit/markdown-reader.js';
import { parseBlocks } from './kit/markdown-blocks.js';
import { validateDocument } from './kit/schema.js';
import { withExtension } from './kit/parse.js';

export interface ConvertRequest {
    text: string;
    /** The input's name; drives detection and companion resolution. */
    fileName?: string;
    language?: Language | string;
    /** The input encoding; detected from the file name, then the text, when absent. */
    from?: Format | string;
    to: Format | string;
    pretty?: boolean;
    /** Fail (no output) on any error instead of emitting best-effort output. */
    strict?: boolean;
    /** Companion texts (a scenario's domain) and/or a resolver for them. */
    companions?: ParseContext['companions'];
    resolve?: ParseContext['resolve'];
    /** With `--raw` on a DSL input, emit the normalizer's input untouched (reserved). */
}

export interface ConvertResult {
    language: Language;
    from: Format;
    to: Format;
    /** Empty when `strict` and an error occurred. */
    output: string;
    model: unknown;
    diagnostics: Diagnostic[];
    ok: boolean;
}

export interface ReadResult {
    language: Language;
    from: Format;
    model: unknown;
    diagnostics: Diagnostic[];
    ok: boolean;
    /** The DSL text the model was parsed from (the input itself for a DSL input). */
    dsl: string;
}

function fail(message: string, source: Diagnostic['source'] = 'detect'): Diagnostic {
    return { severity: 'error', line: 1, column: 1, message, source };
}

function decodeDocument(format: Format, text: string): { doc?: Record<string, unknown>; error?: string } {
    try {
        const v = format === 'json' ? JSON.parse(text) : parseYaml(text, { version: '1.2' });
        if (v === null || typeof v !== 'object' || Array.isArray(v)) return { error: `the ${format} document must be an object` };
        return { doc: v as Record<string, unknown> };
    } catch (e) {
        return { error: `invalid ${format}: ${(e as Error).message}` };
    }
}

/** Resolve language and format from the request, the file name and the text. */
export function detect(req: Pick<ConvertRequest, 'text' | 'fileName' | 'language' | 'from'>): {
    language?: Language;
    from: Format;
    doc?: Record<string, unknown>;
    header?: Record<string, string>;
    error?: string;
} {
    const byName = detectFromFileName(req.fileName);
    const from = (req.from && normalizeFormat(String(req.from))) || byName.format || detectFormatFromText(req.text);
    let language = (req.language && normalizeLanguage(String(req.language))) || byName.language;
    let doc: Record<string, unknown> | undefined;
    let header: Record<string, string> | undefined;
    let error: string | undefined;
    if (from === 'json' || from === 'yaml') {
        const d = decodeDocument(from, req.text);
        doc = d.doc;
        error = d.error;
    } else if (from === 'markdown') {
        const first = parseBlocks(req.text)[0];
        if (first?.type === 'frontmatter') header = parseFrontMatter(first.text);
    }
    if (!language) {
        language =
            from === 'dsl'
                ? detectLanguageFromDocument('dsl', req.text) ?? dslLanguage(req.text)
                : detectLanguageFromDocument(from, req.text, doc, header);
    }
    return { language, from, doc, header, error };
}

function dslLanguage(text: string): Language | undefined {
    // detectLanguageFromDocument already tried `$schema`/front matter; for DSL text use the root keyword
    return detectRoot(text);
}

import { dslRootKeyword } from './kit/detect.js';
function detectRoot(text: string): Language | undefined {
    return dslRootKeyword(text);
}

/** Read an input in any encoding into the canonical model. */
export async function read(req: Omit<ConvertRequest, 'to'>): Promise<ReadResult> {
    const d = detect(req);
    const diagnostics: Diagnostic[] = [];
    if (d.error) diagnostics.push(fail(d.error));
    if (!d.language) {
        diagnostics.push(fail('cannot tell the language: name the file <name>.<domain|prd|sysreq|arch|synth>[.json|.yaml|.md] or pass --language'));
        return { language: 'domain', from: d.from, model: undefined, diagnostics, ok: false, dsl: '' };
    }
    const codec = codecFor(d.language);
    const fileName = withExtension(req.fileName ?? `model${codec.extension}`, codec.extension);
    const ctx: ParseContext = { fileName, companions: req.companions, resolve: req.resolve };

    if (d.from === 'dsl') {
        const r = await codec.parse(req.text, ctx);
        return { language: d.language, from: 'dsl', model: r.model, diagnostics: r.diagnostics, ok: r.ok, dsl: req.text };
    }

    if (d.from === 'json' || d.from === 'yaml') {
        if (!d.doc) return { language: d.language, from: d.from, model: undefined, diagnostics, ok: false, dsl: '' };
        diagnostics.push(...validateDocument(codec.schema(), d.doc));
        let dsl: string;
        try {
            dsl = codec.print(d.doc);
        } catch (e) {
            diagnostics.push(fail(`cannot print the document as ${codec.extension}: ${(e as Error).message}`, 'printer'));
            return { language: d.language, from: d.from, model: d.doc, diagnostics, ok: false, dsl: '' };
        }
        const r = await codec.parse(dsl, ctx);
        diagnostics.push(...r.diagnostics.map(x => ({ ...x, message: x.source === 'parser' ? `${x.message} (in the DSL printed from the document, line ${x.line})` : x.message })));
        return { language: d.language, from: d.from, model: r.model, diagnostics, ok: !diagnostics.some(x => x.severity === 'error'), dsl };
    }

    // markdown
    const md = codec.fromMarkdown(req.text, ctx);
    diagnostics.push(...md.diagnostics);
    const r = await codec.parse(md.dsl, ctx);
    diagnostics.push(...r.diagnostics.map(x => (x.source === 'parser' ? { ...x, line: md.mapLine(x.line), column: 1, message: `${x.message} (DSL line ${x.line})` } : x)));
    return { language: d.language, from: 'markdown', model: r.model, diagnostics, ok: !diagnostics.some(x => x.severity === 'error'), dsl: md.dsl };
}

/** Serialize a model in one encoding. */
export function write(codec: ModelCodec, model: unknown, to: Format, pretty = false): string {
    switch (to) {
        case 'dsl':
            return codec.print(model);
        case 'json':
            return JSON.stringify(model, null, pretty ? 2 : undefined) + (pretty ? '\n' : '');
        case 'yaml':
            return yamlStringify(model, { version: '1.2' });
        case 'markdown':
            return codec.toMarkdown(model);
    }
}

export async function convert(req: ConvertRequest): Promise<ConvertResult> {
    const to = normalizeFormat(String(req.to));
    if (!to) {
        return { language: 'domain', from: 'dsl', to: 'json', output: '', model: undefined, diagnostics: [fail(`unknown output format "${req.to}": dsl, json, yaml or markdown`)], ok: false };
    }
    const r = await read(req);
    const diagnostics = [...r.diagnostics];
    let output = '';
    if (r.model !== undefined && (!req.strict || r.ok)) {
        try {
            output = write(codecFor(r.language), r.model, to, req.pretty);
        } catch (e) {
            diagnostics.push(fail(`cannot write ${to}: ${(e as Error).message}`, 'printer'));
        }
    }
    const ok = !diagnostics.some(x => x.severity === 'error');
    return { language: r.language, from: r.from, to, output: req.strict && !ok ? '' : output, model: r.model, diagnostics, ok };
}

/** Lines for a terminal: `file:line:col [severity] message`. */
export function formatDiagnostics(fileName: string, diagnostics: Diagnostic[]): string[] {
    return diagnostics.map(d => `${fileName}:${d.line}:${d.column} [${d.severity}]${d.source && d.source !== 'parser' ? ` (${d.source})` : ''} ${d.message}`);
}
