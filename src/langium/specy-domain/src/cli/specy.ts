#!/usr/bin/env node
/**
 * `specy` — one CLI for every Specy model in every encoding.
 *
 *   specy convert orders.domain --to markdown            # DSL -> Markdown
 *   specy convert orders.domain.yaml --to dsl -o orders.domain
 *   specy convert draft.prd.md --to json --pretty         # Markdown -> JSON (via the parser)
 *   specy validate catalogue.synth.yaml                   # schema + grammar + references
 *   specy formats                                         # the matrix
 *
 * The language comes from the file name (`<name>.<domain|prd|sysreq|arch|synth>[.json|.yaml|.md]`),
 * the `$schema` of a JSON/YAML document, the `specy:` key of a Markdown front
 * matter or the DSL's root keyword; `--language` overrides. A scenario's
 * `domain-source` (or `domain`) is read from the disk next to the input.
 */
import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PARSER_VERSION } from './version.js';
import { FORMATS, LANGUAGES, codecFor, convert, detect, formatDiagnostics, read, type Format, type Language } from '../formats/index.js';

const program = new Command();

program.name('specy').description('Convert and validate Specy models (.domain, .prd, .sysreq, .arch, .synth) between DSL, JSON, YAML and Markdown').version(PARSER_VERSION);

function readInput(file: string): { text: string; filePath: string } {
    const filePath = path.resolve(file);
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }
    return { text: fs.readFileSync(filePath, 'utf8'), filePath };
}

/** Companion files (a scenario's domain) resolve on the disk, relative to the input. */
function resolver(filePath: string): (rel: string) => string | undefined {
    return rel => {
        const p = path.resolve(path.dirname(filePath), rel);
        return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : undefined;
    };
}

/** A path as the user would type it: relative when it sits under the working directory, absolute otherwise. */
function display(filePath: string): string {
    const rel = path.relative(process.cwd(), filePath);
    return rel === '' ? '.' : rel.startsWith('..') ? filePath : rel;
}

function report(filePath: string, diagnostics: Parameters<typeof formatDiagnostics>[1]): void {
    for (const line of formatDiagnostics(display(filePath), diagnostics)) console.error(line);
}

/** `<name>.<lang>.<ext>` next to the input, for `-o` without a value. */
function defaultOutput(filePath: string, language: Language, to: Format): string {
    const codec = codecFor(language);
    const base = path.basename(filePath).replace(/\.(json|ya?ml|md|markdown)$/i, '');
    const stem = base.toLowerCase().endsWith(codec.extension) ? base : `${base}${codec.extension}`;
    const ext = to === 'dsl' ? '' : to === 'markdown' ? '.md' : `.${to}`;
    return path.join(path.dirname(filePath), `${stem}${ext}`);
}

program
    .command('convert')
    .description('Convert a model file to another encoding (dsl, json, yaml, markdown)')
    .argument('<file>', 'Input: a .domain/.prd/.sysreq/.arch/.synth file, or its .json/.yaml/.md form')
    .requiredOption('-t, --to <format>', 'Output encoding: dsl, json, yaml or markdown (md)')
    .option('-f, --from <format>', 'Input encoding, when the file name does not say')
    .option('-l, --language <language>', 'domain, prd, sysreq, architecture or synth, when the file name does not say')
    .option('-o, --output [file]', 'Write to a file (default: stdout; a bare -o names it <input>.<lang>.<ext>)')
    .option('--pretty', 'Pretty-print JSON')
    .option('--strict', 'Exit 1 and write nothing on any error (default: best-effort output + diagnostics on stderr)')
    .action(async (file: string, options: { to: string; from?: string; language?: string; output?: string | boolean; pretty?: boolean; strict?: boolean }) => {
        const { text, filePath } = readInput(file);
        const result = await convert({
            text,
            fileName: filePath,
            from: options.from,
            language: options.language,
            to: options.to,
            pretty: options.pretty,
            strict: options.strict,
            resolve: resolver(filePath),
        });
        report(filePath, result.diagnostics);
        if (result.output === '' && !result.ok) {
            console.error(`${result.language}: no output (${result.diagnostics.filter(d => d.severity === 'error').length} error(s))`);
            process.exit(1);
        }
        if (options.output !== undefined && options.output !== false) {
            const out = typeof options.output === 'string' ? path.resolve(options.output) : defaultOutput(filePath, result.language, result.to);
            fs.writeFileSync(out, result.output);
            console.error(`${result.language} ${result.from} -> ${result.to}: ${display(out)}`);
        } else {
            process.stdout.write(result.output);
        }
        process.exit(result.ok ? 0 : options.strict ? 1 : 0);
    });

program
    .command('validate')
    .description('Validate a model file in any encoding: JSON Schema (json/yaml), Markdown mapping, grammar, semantic rules, references')
    .argument('<file>', 'Input file')
    .option('-f, --from <format>', 'Input encoding, when the file name does not say')
    .option('-l, --language <language>', 'Language, when the file name does not say')
    .option('--dsl', 'Also print the DSL the document was checked as (json/yaml/markdown inputs)')
    .action(async (file: string, options: { from?: string; language?: string; dsl?: boolean }) => {
        const { text, filePath } = readInput(file);
        const result = await read({ text, fileName: filePath, from: options.from, language: options.language, resolve: resolver(filePath) });
        report(filePath, result.diagnostics);
        if (options.dsl && result.from !== 'dsl') process.stdout.write(result.dsl);
        const errors = result.diagnostics.filter(d => d.severity === 'error').length;
        const warnings = result.diagnostics.filter(d => d.severity === 'warning').length;
        console.log(`${display(filePath)}: ${result.language} (${result.from}) ${errors ? `${errors} error(s)` : 'OK'}${warnings ? `, ${warnings} warning(s)` : ''}`);
        process.exit(errors ? 1 : 0);
    });

program
    .command('detect')
    .description('Say which language and encoding a file is read as')
    .argument('<file>', 'Input file')
    .action((file: string) => {
        const { text, filePath } = readInput(file);
        const d = detect({ text, fileName: filePath });
        console.log(`${display(filePath)}: language=${d.language ?? '?'} format=${d.from}${d.error ? ` (${d.error})` : ''}`);
    });

program
    .command('formats')
    .description('The conversion matrix: every language reads and writes every encoding')
    .action(() => {
        console.log(`languages: ${LANGUAGES.join(', ')}`);
        console.log(`encodings: ${FORMATS.join(', ')}`);
        console.log('');
        console.log('file names: <name>.<domain|prd|sysreq|arch|synth>            DSL');
        console.log('            <name>.<language>.json | .yaml | .md             the same document');
        console.log('');
        console.log('reading json/yaml: JSON Schema, then printed to DSL and parsed (grammar, rules, references)');
        console.log('reading markdown:  the conventions of MODEL-FORMATS.md transpile to DSL; the rest is reported as unmapped');
    });

program.parse();
