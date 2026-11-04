/**
 * One document, four encodings.
 *
 * Every Specy language (.domain, .prd, .sysreq, .arch, .synth) is one model
 * with four encodings: the DSL people write, JSON and YAML for programs and
 * language models, Markdown for documents. A ModelCodec gathers, for one
 * language, the four conversions the matrix needs:
 *
 *   DSL      -> model   parse        (the Langium parser: the only semantics)
 *   model    -> DSL     print
 *   model    -> MD      toMarkdown
 *   MD       -> DSL     fromMarkdown (then parse, so Markdown shares the DSL's rules)
 *   JSON/YAML <-> model  serialization + the JSON Schema of the document
 *
 * Reading JSON, YAML or Markdown always ends in the parser: the text is
 * printed (or transpiled) to DSL and parsed again, so a document in any format
 * is validated by the same grammar, validator and cross-references as the DSL,
 * and the model handed back is the canonical one.
 */

export type Language = 'domain' | 'prd' | 'sysreq' | 'architecture' | 'synth';

export type Format = 'dsl' | 'json' | 'yaml' | 'markdown';

export const LANGUAGES: Language[] = ['domain', 'prd', 'sysreq', 'architecture', 'synth'];
export const FORMATS: Format[] = ['dsl', 'json', 'yaml', 'markdown'];

export interface Diagnostic {
    severity: 'error' | 'warning' | 'info' | 'hint';
    /** 1-based line in the input text (Markdown lines for a Markdown input). */
    line: number;
    /** 1-based. */
    column: number;
    message: string;
    code?: string;
    /** Which stage raised it. */
    source?: 'parser' | 'schema' | 'markdown' | 'printer' | 'detect';
}

/** A companion text a parse needs besides the file itself (a scenario's `.domain`). */
export interface CompanionDocument {
    fileName: string;
    text: string;
}

export interface ParseContext {
    /** Name (or path) the text is known by; relative companions resolve against its folder. */
    fileName: string;
    /** Documents the parse may link into, keyed by the path the text names them by. */
    companions?: CompanionDocument[];
    /** Load a companion on demand by the path the document names, relative to `fileName`'s folder. */
    resolve?: (relativePath: string) => string | undefined;
}

export interface ParseResult<M> {
    /** The clean model; best-effort from the recovered AST when `ok` is false. */
    model: M;
    diagnostics: Diagnostic[];
    /** No error-level diagnostic. */
    ok: boolean;
}

export interface MarkdownReadResult {
    dsl: string;
    diagnostics: Diagnostic[];
    mapLine(dslLine: number): number;
    header: Record<string, string>;
}

export interface ModelCodec<M = unknown> {
    language: Language;
    /** The DSL file extension, with the dot. */
    extension: string;
    /** `$id` of the document's JSON Schema; its trailing number is the format's major version. */
    schemaId: string;
    /** The JSON Schema of the document (JSON and YAML share it). */
    schema: () => Record<string, unknown>;
    parse(text: string, ctx: ParseContext): Promise<ParseResult<M>>;
    /** Model -> DSL. Throws a descriptive Error on a document the printer cannot place. */
    print(model: M): string;
    toMarkdown(model: M): string;
    fromMarkdown(markdown: string, ctx: ParseContext): MarkdownReadResult;
    /**
     * The name of the companion document a parsed model needs, if any (a
     * scenario's `domain`), read from a document that did not go through the
     * DSL yet (JSON, YAML, or the Markdown header).
     */
    companionOf?(document: Record<string, unknown>, header?: Record<string, string>): string | undefined;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const registry = new Map<Language, ModelCodec>();

export function registerCodec(codec: ModelCodec<any>): void {
    registry.set(codec.language, codec);
}

export function codecFor(language: Language): ModelCodec {
    const c = registry.get(language);
    if (!c) throw new Error(`No codec registered for language "${language}"`);
    return c;
}

export function registeredLanguages(): Language[] {
    return [...registry.keys()];
}

export function isLanguage(s: string): s is Language {
    return (LANGUAGES as string[]).includes(s);
}

export function isFormat(s: string): s is Format {
    return (FORMATS as string[]).includes(s);
}

/** Accept the spellings people type: md, yml, text, arch… */
export function normalizeFormat(s: string): Format | undefined {
    const v = s.toLowerCase();
    if (v === 'md' || v === 'markdown') return 'markdown';
    if (v === 'yml' || v === 'yaml') return 'yaml';
    if (v === 'json') return 'json';
    if (v === 'dsl' || v === 'text' || v === 'specy') return 'dsl';
    return undefined;
}

export function normalizeLanguage(s: string): Language | undefined {
    const v = s.toLowerCase().replace(/^\./, '');
    if (v === 'arch' || v === 'architecture') return 'architecture';
    if (v === 'req' || v === 'sysreq' || v === 'requirements') return 'sysreq';
    if (v === 'prd' || v === 'product') return 'prd';
    if (v === 'domain') return 'domain';
    if (v === 'synth' || v === 'scenario') return 'synth';
    return undefined;
}
