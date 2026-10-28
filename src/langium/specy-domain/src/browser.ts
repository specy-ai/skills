/**
 * Browser entry point: parse `.domain` and `.synth` text in the page and return
 * the same clean JSON the CLIs emit (`specy-domain parse`, `specy-synth parse`).
 *
 * Built by `npm run build:browser` into out/browser/specy-domain-langium.js
 * (an IIFE exposing `window.SpecyDomainLangium`) and .mjs (ESM). The Specy
 * app vendors the IIFE; synthy and any other consumer that wants the exact
 * parsers of the CLIs, not an approximation, can use either.
 *
 * Headless core services on an empty file system, both languages on one shared
 * set: one grammar each, one generated module, one validator — the browser can
 * never disagree with the CLI about what a file means, and a scenario resolves
 * its references into the domain text it is given exactly as the CLI resolves
 * them into the file `domain-source` names.
 */
import { EmptyFileSystem, URI, type LangiumDocument } from 'langium';
import { createSpecyServices } from './language/specy-synth-module.js';
import { normalizeDomain, type DomainModel } from './cli/domain-model.js';
import { normalizeScenario, type ScenarioJson } from './cli/synth-model.js';
import type { DomainFile, SynthFile } from './generated/ast.js';

export type { DomainModel } from './cli/domain-model.js';
export type { ScenarioJson } from './cli/synth-model.js';

export interface ParseDiagnostic {
    severity: 'error' | 'warning' | 'info' | 'hint';
    /** 1-based */
    line: number;
    /** 1-based */
    column: number;
    message: string;
    /** The conflict code of the rule, when it has one (SYN-E006, ...). */
    code?: string;
}

export interface ParseOutcome {
    /** The clean model; best-effort from the recovered AST when `ok` is false. */
    model: DomainModel;
    diagnostics: ParseDiagnostic[];
    /** No error-level diagnostic. */
    ok: boolean;
}

export interface SynthParseOutcome {
    /** The scenario JSON synthy consumes; best-effort when `ok` is false. */
    scenario: ScenarioJson;
    diagnostics: ParseDiagnostic[];
    /** Diagnostics of the domain text, reported separately so the scenario editor shows only its own. */
    domainDiagnostics: ParseDiagnostic[];
    /** No error-level diagnostic in the scenario. */
    ok: boolean;
}

const SEVERITY: Record<number, ParseDiagnostic['severity']> = { 1: 'error', 2: 'warning', 3: 'info', 4: 'hint' };

let services: ReturnType<typeof createSpecyServices> | undefined;
let counter = 0;

function servicesOnce() {
    return (services ??= createSpecyServices(EmptyFileSystem));
}

function safeName(fileName: string): string {
    return fileName.replace(/[^A-Za-z0-9._/-]/g, '_').replace(/^\/+/, '');
}

function toDiagnostics(document: LangiumDocument): ParseDiagnostic[] {
    return (document.diagnostics ?? []).map(d => ({
        severity: SEVERITY[d.severity ?? 1] ?? 'error',
        line: d.range.start.line + 1,
        column: d.range.start.character + 1,
        message: d.message,
        code: d.code === undefined ? undefined : String(d.code),
    }));
}

/** Parse one .domain text. Each call works on its own in-memory document. */
export async function parseDomain(text: string, fileName = 'model.domain'): Promise<ParseOutcome> {
    const { shared } = servicesOnce();
    const uri = URI.parse(`memory:/${counter++}/${safeName(fileName)}`);
    const document = shared.workspace.LangiumDocumentFactory.fromString<DomainFile>(text, uri);
    shared.workspace.LangiumDocuments.addDocument(document);
    try {
        await shared.workspace.DocumentBuilder.build([document], { validation: true });
        const diagnostics = toDiagnostics(document);
        const model = normalizeDomain(document.parseResult.value);
        return { model, diagnostics, ok: !diagnostics.some(d => d.severity === 'error') };
    } finally {
        shared.workspace.LangiumDocuments.deleteDocument(uri);
    }
}

/**
 * Parse one .synth text against one .domain text. The domain document is
 * created under the path the scenario's `domain-source` names, so the
 * scenario's references resolve exactly as they would on disk.
 */
export async function parseSynth(synthText: string, domainText: string, fileName = 'scenario.synth'): Promise<SynthParseOutcome> {
    const { shared } = servicesOnce();
    const folder = `memory:/${counter++}`;
    const synthUri = URI.parse(`${folder}/${safeName(fileName)}`);
    const synth = shared.workspace.LangiumDocumentFactory.fromString<SynthFile>(synthText, synthUri);
    const declared = synth.parseResult.value.scenario?.domainSource?.path ?? 'model.domain';
    const domainUri = URI.parse(`${folder}/${safeName(declared)}`);
    const domain = shared.workspace.LangiumDocumentFactory.fromString<DomainFile>(domainText, domainUri);
    shared.workspace.LangiumDocuments.addDocument(domain);
    shared.workspace.LangiumDocuments.addDocument(synth);
    try {
        await shared.workspace.DocumentBuilder.build([domain, synth] as LangiumDocument[], { validation: true });
        const diagnostics = toDiagnostics(synth);
        return {
            scenario: normalizeScenario(synth.parseResult.value),
            diagnostics,
            domainDiagnostics: toDiagnostics(domain),
            ok: !diagnostics.some(d => d.severity === 'error'),
        };
    } finally {
        shared.workspace.LangiumDocuments.deleteDocument(synthUri);
        shared.workspace.LangiumDocuments.deleteDocument(domainUri);
    }
}

export { PARSER_VERSION as VERSION } from './cli/version.js';
