#!/usr/bin/env node
/**
 * specy-synth: parse and validate .synth scenarios against their .domain.
 *
 *   specy-synth parse    <file.synth> [-f json|yaml] [--pretty] [--strict]   -> the scenario document synthy reads
 *   specy-synth validate <file.synth>                                         -> diagnostics, exit 1 on errors
 *
 * The document is the same in both formats (src/schemas/synth-scenario.schema.json);
 * YAML is written with the 1.2 core schema and quotes every scalar a YAML 1.1
 * reader would retype (dates, yes/no, on/off).
 *
 * The scenario names its model with `domain-source`; the CLI loads that file
 * next to the scenario so every entity, field, state and member resolves.
 */
import { Command } from 'commander';
import { Document, visit } from 'yaml';
import { NodeFileSystem } from 'langium/node';
import { URI, type LangiumDocument } from 'langium';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createSpecyServices } from '../language/specy-synth-module.js';
import { normalizeScenario } from './synth-model.js';
import { PARSER_VERSION } from './version.js';
import type { SynthFile } from '../generated/ast.js';

interface Diagnostic {
    severity?: number;
    range: { start: { line: number; character: number } };
    message: string;
    code?: string | number;
}

interface Loaded {
    synth: LangiumDocument<SynthFile>;
    domain?: LangiumDocument;
    domainPath?: string;
}

/** Parse the .synth, load the .domain it declares when it exists, build both with validation. */
export async function loadScenario(filePath: string): Promise<Loaded> {
    const services = createSpecyServices(NodeFileSystem);
    const documents = services.shared.workspace.LangiumDocuments;
    const synth = (await documents.getOrCreateDocument(URI.file(filePath))) as LangiumDocument<SynthFile>;
    const declared = synth.parseResult.value.scenario?.domainSource?.path;
    const domainPath = declared ? path.resolve(path.dirname(filePath), declared) : undefined;
    const toBuild: LangiumDocument[] = [];
    let domain: LangiumDocument | undefined;
    if (domainPath && fs.existsSync(domainPath)) {
        domain = await documents.getOrCreateDocument(URI.file(domainPath));
        toBuild.push(domain);
    }
    toBuild.push(synth);
    await services.shared.workspace.DocumentBuilder.build(toBuild, { validation: true });
    return { synth, domain, domainPath };
}

/**
 * A YAML 1.1 reader (PyYAML, older tools) would read these plain scalars as booleans,
 * nulls, numbers, dates or a merge key. Kept identical to toYaml in synthy's
 * src/scenario/format.ts: the two write the same bytes for the same scenario.
 */
const YAML11_RETYPED = /^(y|n|yes|no|on|off|true|false|null|~|<<|[-+]?(0b[01_]+|0x[0-9a-fA-F_]+|0[0-7_]+|[0-9][0-9_]*(:[0-5]?[0-9])+(\.[0-9_]*)?|[0-9][0-9_]*(\.[0-9_]*)?([eE][-+]?[0-9]+)?|\.[0-9_]+([eE][-+]?[0-9]+)?|\.inf)|\.nan|\d{4}-\d{1,2}-\d{1,2}([Tt ].*)?)$/i;

function toYaml(value: unknown): string {
    const doc = new Document(value, { version: '1.2' });
    visit(doc, {
        Scalar(_key, node) {
            if (typeof node.value === 'string' && YAML11_RETYPED.test(node.value)) node.type = 'QUOTE_DOUBLE';
        },
    });
    return doc.toString({ indent: 2, lineWidth: 0, minContentWidth: 0 });
}

function diagnosticsOf(doc: LangiumDocument): Diagnostic[] {
    return (doc.diagnostics ?? []) as Diagnostic[];
}

function print(file: string, diags: Diagnostic[], out: (s: string) => void): void {
    const labels = ['', 'error', 'warning', 'info', 'hint'];
    for (const d of diags) {
        const code = d.code ? ` ${d.code}` : '';
        out(`${file}:${d.range.start.line + 1}:${d.range.start.character + 1} [${labels[d.severity ?? 4]}${code}] ${d.message}`);
    }
}

const program = new Command();

program.name('specy-synth').description('Specy synthetic-data scenario (.synth) parser and validator').version(PARSER_VERSION);

program
    .command('parse')
    .description('Parse a .synth scenario and output the scenario document synthy reads, as JSON or YAML (best-effort on errors; --strict fails instead)')
    .argument('<file>', 'Path to .synth file')
    .option('-f, --format <format>', 'Output format: json or yaml', 'json')
    .option('--pretty', 'Pretty-print JSON output')
    .option('--strict', 'Exit 1 on any error instead of emitting best-effort output')
    .action(async (file: string, options: { format: string; pretty?: boolean; strict?: boolean }) => {
        const format = options.format.toLowerCase();
        if (format !== 'json' && format !== 'yaml' && format !== 'yml') {
            console.error(`Unknown format: ${options.format} (json or yaml)`);
            process.exit(1);
        }
        const filePath = path.resolve(file);
        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            process.exit(1);
        }
        const { synth, domain } = await loadScenario(filePath);
        const errors = diagnosticsOf(synth).filter(d => d.severity === 1);
        const domainErrors = domain ? diagnosticsOf(domain).filter(d => d.severity === 1) : [];
        if (errors.length || domainErrors.length) {
            console.error(`${options.strict ? 'Errors' : 'Warning: errors'} in ${file} (${errors.length + domainErrors.length}):`);
            print(file, errors, console.error);
            if (domain) print(path.relative(process.cwd(), domain.uri.fsPath), domainErrors, console.error);
            if (options.strict) process.exit(1);
            console.error('Emitting best-effort output from the recovered AST.');
        }
        const scenario = normalizeScenario(synth.parseResult.value);
        if (format === 'json') console.log(JSON.stringify(scenario, null, options.pretty ? 2 : undefined));
        else process.stdout.write(toYaml(scenario));
    });

program
    .command('validate')
    .description('Validate a .synth scenario against its domain-source and report diagnostics')
    .argument('<file>', 'Path to .synth file')
    .action(async (file: string) => {
        const filePath = path.resolve(file);
        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            process.exit(1);
        }
        const { synth, domainPath } = await loadScenario(filePath);
        const diags = diagnosticsOf(synth);
        if (domainPath && !fs.existsSync(domainPath)) console.log(`${file}: domain-source ${path.relative(process.cwd(), domainPath)} does not exist`);
        if (diags.length === 0) {
            console.log(`${file}: OK (no issues)`);
            process.exit(0);
        }
        print(file, diags, console.log);
        process.exit(diags.some(d => d.severity === 1) ? 1 : 0);
    });

program.parse();
