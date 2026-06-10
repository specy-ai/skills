#!/usr/bin/env node
import { Command } from 'commander';
import { NodeFileSystem } from 'langium/node';
import { createSpecyDomainServices } from '../language/specy-domain-module.js';
import { astToJson } from './json-serializer.js';
import { normalizeDomain } from './domain-model.js';
import { modelToMarkdown } from './markdown-serializer.js';
import { URI } from 'langium';
import { stringify as yamlStringify } from 'yaml';
import * as fs from 'node:fs';
import * as path from 'node:path';
const program = new Command();
program
    .name('specy-domain')
    .description('Specy Domain DSL parser and validator')
    .version('1.0.0');
program
    .command('parse')
    .description('Parse a .domain file and output JSON, YAML, or Markdown (best-effort on parse errors; use --strict to fail instead)')
    .argument('<file>', 'Path to .domain file')
    .option('-f, --format <format>', 'Output format: json, yaml, or markdown', 'json')
    .option('--pretty', 'Pretty-print JSON output')
    .option('--raw', 'Emit the faithful Langium AST instead of the clean domain model (json/yaml only)')
    .option('--strict', 'Exit with an error on parse errors instead of emitting best-effort output from the recovered AST')
    .action(async (file, options) => {
    const filePath = path.resolve(file);
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }
    const services = createSpecyDomainServices(NodeFileSystem);
    const document = await services.shared.workspace.LangiumDocuments.getOrCreateDocument(URI.file(filePath));
    await services.shared.workspace.DocumentBuilder.build([document], {
        validation: true,
    });
    const diagnostics = (document.diagnostics ?? []);
    const errors = diagnostics.filter(d => d.severity === 1);
    if (errors.length > 0) {
        const label = options.strict ? 'Parse errors' : 'Warning: parse errors';
        console.error(`${label} in ${file} (${errors.length}):`);
        for (const diag of errors) {
            const line = diag.range.start.line + 1;
            const col = diag.range.start.character + 1;
            console.error(`  ${line}:${col} - ${diag.message}`);
        }
        if (options.strict) {
            process.exit(1);
        }
        console.error('Emitting best-effort output from the recovered partial AST; unparsed regions are omitted.');
    }
    const ast = document.parseResult.value;
    const format = options.format.toLowerCase();
    let output;
    try {
        if (format === 'markdown' || format === 'md') {
            if (options.raw) {
                console.error('--raw is only supported for json and yaml formats');
                process.exit(1);
            }
            output = modelToMarkdown(normalizeDomain(ast));
        }
        else if (format === 'json' || format === 'yaml' || format === 'yml') {
            const data = options.raw ? astToJson(ast) : normalizeDomain(ast);
            output =
                format === 'json'
                    ? JSON.stringify(data, null, options.pretty ? 2 : undefined)
                    : yamlStringify(data);
        }
        else {
            console.error(`Unknown format: ${options.format}`);
            process.exit(1);
            return;
        }
    }
    catch (err) {
        console.error(`Failed to serialize ${file}: ${err?.message ?? String(err)}`);
        process.exit(1);
        return;
    }
    console.log(output);
});
program
    .command('validate')
    .description('Validate a .domain file and report diagnostics')
    .argument('<file>', 'Path to .domain file')
    .action(async (file) => {
    const filePath = path.resolve(file);
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }
    const services = createSpecyDomainServices(NodeFileSystem);
    const document = await services.shared.workspace.LangiumDocuments.getOrCreateDocument(URI.file(filePath));
    await services.shared.workspace.DocumentBuilder.build([document], {
        validation: true,
    });
    const diagnostics = (document.diagnostics ?? []);
    if (diagnostics.length === 0) {
        console.log(`${file}: OK (no issues)`);
        process.exit(0);
    }
    const severityLabels = ['', 'error', 'warning', 'info', 'hint'];
    let hasErrors = false;
    for (const diag of diagnostics) {
        const severity = severityLabels[diag.severity ?? 4];
        const line = diag.range.start.line + 1;
        const col = diag.range.start.character + 1;
        console.log(`${file}:${line}:${col} [${severity}] ${diag.message}`);
        if (diag.severity === 1)
            hasErrors = true;
    }
    process.exit(hasErrors ? 1 : 0);
});
program.parse();
//# sourceMappingURL=index.js.map