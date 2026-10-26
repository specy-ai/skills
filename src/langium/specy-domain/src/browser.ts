/**
 * Browser entry point: parse `.domain` text in the page and return the same
 * clean domain model the CLI emits (`specy-domain parse --format json`).
 *
 * Built by `npm run build:browser` into out/browser/specy-domain-langium.js
 * (an IIFE exposing `window.SpecyDomainLangium`) and .mjs (ESM). The Specy
 * app vendors the IIFE; synthy and any other consumer that wants the exact
 * parser of the CLI, not an approximation, can use either.
 *
 * Headless core services on an empty file system: one grammar, one generated
 * module, one validator — the browser can never disagree with the CLI about
 * what a .domain file means.
 */
import { EmptyFileSystem, URI } from 'langium';
import { createSpecyDomainServices } from './language/specy-domain-module.js';
import { normalizeDomain, type DomainModel } from './cli/domain-model.js';
import type { DomainFile } from './generated/ast.js';

export type { DomainModel } from './cli/domain-model.js';

export interface ParseDiagnostic {
    severity: 'error' | 'warning' | 'info' | 'hint';
    /** 1-based */
    line: number;
    /** 1-based */
    column: number;
    message: string;
}

export interface ParseOutcome {
    /** The clean model; best-effort from the recovered AST when `ok` is false. */
    model: DomainModel;
    diagnostics: ParseDiagnostic[];
    /** No error-level diagnostic. */
    ok: boolean;
}

const SEVERITY: Record<number, ParseDiagnostic['severity']> = { 1: 'error', 2: 'warning', 3: 'info', 4: 'hint' };

let services: ReturnType<typeof createSpecyDomainServices> | undefined;
let counter = 0;

function servicesOnce() {
    return (services ??= createSpecyDomainServices(EmptyFileSystem));
}

/** Parse one .domain text. Each call works on its own in-memory document. */
export async function parseDomain(text: string, fileName = 'model.domain'): Promise<ParseOutcome> {
    const { shared } = servicesOnce();
    const uri = URI.parse(`memory:/${counter++}/${fileName.replace(/[^A-Za-z0-9._-]/g, '_')}`);
    const document = shared.workspace.LangiumDocumentFactory.fromString<DomainFile>(text, uri);
    shared.workspace.LangiumDocuments.addDocument(document);
    try {
        await shared.workspace.DocumentBuilder.build([document], { validation: true });
        const diagnostics: ParseDiagnostic[] = (document.diagnostics ?? []).map(d => ({
            severity: SEVERITY[d.severity ?? 1] ?? 'error',
            line: d.range.start.line + 1,
            column: d.range.start.character + 1,
            message: d.message,
        }));
        const model = normalizeDomain(document.parseResult.value);
        return { model, diagnostics, ok: !diagnostics.some(d => d.severity === 'error') };
    } finally {
        shared.workspace.LangiumDocuments.deleteDocument(uri);
    }
}

export { PARSER_VERSION as VERSION } from './cli/version.js';
