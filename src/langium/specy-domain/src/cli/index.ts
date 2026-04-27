#!/usr/bin/env node

import { Command } from 'commander';
import { NodeFileSystem } from 'langium/node';
import { createSpecyDomainServices } from '../language/specy-domain-module.js';
import { astToJson } from './json-serializer.js';
import { URI } from 'langium';
import * as fs from 'node:fs';
import * as path from 'node:path';

const program = new Command();

program
    .name('specy-domain')
    .description('Specy Domain DSL parser and validator')
    .version('1.0.0');

program
    .command('parse')
    .description('Parse a .domain file and output JSON or Markdown')
    .argument('<file>', 'Path to .domain file')
    .option('-f, --format <format>', 'Output format: json or markdown', 'json')
    .option('--pretty', 'Pretty-print JSON output')
    .action(async (file: string, options: { format: string; pretty?: boolean }) => {
        const filePath = path.resolve(file);
        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            process.exit(1);
        }

        const services = createSpecyDomainServices(NodeFileSystem);
        const document = await services.shared.workspace.LangiumDocuments.getOrCreateDocument(
            URI.file(filePath)
        );

        await services.shared.workspace.DocumentBuilder.build([document], {
            validation: true,
        });

        const diagnostics = (document.diagnostics ?? []) as Array<{
            severity?: number;
            range: { start: { line: number; character: number } };
            message: string;
        }>;
        const errors = diagnostics.filter(d => d.severity === 1);

        if (errors.length > 0) {
            console.error(`Parse errors in ${file}:`);
            for (const diag of errors) {
                const line = diag.range.start.line + 1;
                const col = diag.range.start.character + 1;
                console.error(`  ${line}:${col} - ${diag.message}`);
            }
            process.exit(1);
        }

        const ast = document.parseResult.value;

        if (options.format === 'json') {
            const json = astToJson(ast);
            const output = options.pretty
                ? JSON.stringify(json, null, 2)
                : JSON.stringify(json);
            console.log(output);
        } else if (options.format === 'markdown') {
            // TODO: Implement markdown serializer
            console.error('Markdown format not yet implemented');
            process.exit(1);
        } else {
            console.error(`Unknown format: ${options.format}`);
            process.exit(1);
        }
    });

program
    .command('validate')
    .description('Validate a .domain file and report diagnostics')
    .argument('<file>', 'Path to .domain file')
    .action(async (file: string) => {
        const filePath = path.resolve(file);
        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            process.exit(1);
        }

        const services = createSpecyDomainServices(NodeFileSystem);
        const document = await services.shared.workspace.LangiumDocuments.getOrCreateDocument(
            URI.file(filePath)
        );

        await services.shared.workspace.DocumentBuilder.build([document], {
            validation: true,
        });

        const diagnostics = (document.diagnostics ?? []) as Array<{
            severity?: number;
            range: { start: { line: number; character: number } };
            message: string;
        }>;

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
            if (diag.severity === 1) hasErrors = true;
        }

        process.exit(hasErrors ? 1 : 0);
    });

program.parse();
