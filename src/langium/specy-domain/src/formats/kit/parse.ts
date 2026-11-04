/**
 * Parse one text with the Langium services of its language, in memory.
 *
 * The CLI, the tests and the browser bundle all go through here, on one shared
 * service set for the five languages, so a document is parsed the same way
 * wherever it is read. A document that links into another file (a scenario's
 * `domain-source`) names it; the companion is looked up in the context — given
 * texts first, then the caller's resolver (the CLI reads the disk, the browser
 * the files it was handed) — and created at the relative path the document
 * uses, so references resolve exactly as they would on disk.
 */
import { EmptyFileSystem, URI, type AstNode, type LangiumDocument } from 'langium';
import { createSpecyServices } from '../../language/specy-module.js';
import type { Diagnostic, ParseContext } from './codec.js';

let services: ReturnType<typeof createSpecyServices> | undefined;
let counter = 0;

export function specyServices(): ReturnType<typeof createSpecyServices> {
    return (services ??= createSpecyServices(EmptyFileSystem));
}

const SEVERITY: Record<number, Diagnostic['severity']> = { 1: 'error', 2: 'warning', 3: 'info', 4: 'hint' };

export function documentDiagnostics(document: LangiumDocument): Diagnostic[] {
    return (document.diagnostics ?? []).map(d => ({
        severity: SEVERITY[d.severity ?? 1] ?? 'error',
        line: d.range.start.line + 1,
        column: d.range.start.character + 1,
        message: d.message,
        code: d.code === undefined ? undefined : String(d.code),
        source: 'parser' as const,
    }));
}

/** A memory path that keeps the folder structure of `fileName` (companions resolve relative to it). */
function memoryPath(fileName: string): string {
    const clean = fileName.replace(/\\/g, '/').replace(/[^A-Za-z0-9._/-]/g, '_').replace(/^\/+/, '');
    const segments: string[] = [];
    for (const s of clean.split('/')) {
        if (s === '' || s === '.') continue;
        if (s === '..') segments.pop();
        else segments.push(s);
    }
    return segments.join('/');
}

function folderOf(p: string): string {
    const i = p.lastIndexOf('/');
    return i === -1 ? '' : p.slice(0, i + 1);
}

/** Force the DSL extension the language's services are registered under. */
export function withExtension(fileName: string, extension: string): string {
    const base = fileName.replace(/\.(json|ya?ml|md|markdown)$/i, '');
    return base.toLowerCase().endsWith(extension) ? base : `${base}${extension}`;
}

export interface ParsedText<T extends AstNode> {
    ast: T;
    diagnostics: Diagnostic[];
    /** Diagnostics of the companion document, reported apart so the main document's are its own. */
    companionDiagnostics: Diagnostic[];
    /** The companion path the document named, whether or not it was found. */
    companion?: string;
    companionFound?: boolean;
}

export async function parseText<T extends AstNode>(
    fileName: string,
    text: string,
    ctx: ParseContext,
    companionOf?: (ast: T) => string | undefined,
): Promise<ParsedText<T>> {
    const { shared } = specyServices();
    const folder = `memory:/${counter++}/`;
    const mainPath = memoryPath(fileName);
    const mainUri = URI.parse(folder + mainPath);
    const main = shared.workspace.LangiumDocumentFactory.fromString<T>(text, mainUri);
    const docs: LangiumDocument[] = [main];
    const uris = [mainUri];
    let companion: string | undefined;
    let companionFound: boolean | undefined;
    let companionDoc: LangiumDocument | undefined;

    const declared = companionOf?.(main.parseResult.value);
    if (declared) {
        companion = declared;
        const companionText = lookupCompanion(declared, ctx);
        companionFound = companionText !== undefined;
        if (companionText !== undefined) {
            const companionUri = URI.parse(folder + memoryPath(folderOf(mainPath) + declared));
            companionDoc = shared.workspace.LangiumDocumentFactory.fromString(companionText, companionUri);
            docs.unshift(companionDoc);
            uris.push(companionUri);
        }
    }

    for (const d of docs) shared.workspace.LangiumDocuments.addDocument(d);
    try {
        await shared.workspace.DocumentBuilder.build(docs, { validation: true });
        return {
            ast: main.parseResult.value,
            diagnostics: documentDiagnostics(main),
            companionDiagnostics: companionDoc ? documentDiagnostics(companionDoc) : [],
            companion,
            companionFound,
        };
    } finally {
        for (const u of uris) shared.workspace.LangiumDocuments.deleteDocument(u);
    }
}

function lookupCompanion(declared: string, ctx: ParseContext): string | undefined {
    const base = declared.split('/').pop();
    const given = ctx.companions?.find(c => c.fileName === declared || c.fileName.split('/').pop() === base);
    if (given) return given.text;
    return ctx.resolve?.(declared);
}
