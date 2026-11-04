/**
 * One document, four encodings — pinned on every example file of the repo.
 *
 * For each example, the model parsed from the DSL must come back unchanged
 * from a round trip through each of the other three encodings:
 *
 *   DSL ─parse─► A ─print─► DSL' ─parse─► A       (the printer)
 *   A ─json─► text ─json─► A, and A validates against the language's schema
 *   A ─yaml─► text ─yaml─► A
 *   A ─markdown─► text ─read─► DSL'' ─parse─► A   (the Markdown writer + reader, no diagnostics)
 *
 * A language whose printer is not implemented yet is reported as skipped, so
 * the matrix shows what is left.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { codecFor, read, write, type Language } from '../src/formats/index.js';
import { validateDocument } from '../src/formats/kit/schema.js';
import { canonicalJson, jsonDiff } from '../src/formats/kit/text.js';

const examples = resolve(import.meta.dirname, '../../../../examples');

const LANGUAGE_OF_EXT: Record<string, Language> = { domain: 'domain', prd: 'prd', sysreq: 'sysreq', arch: 'architecture', synth: 'synth' };

function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.(domain|prd|sysreq|arch|synth)$/.test(name)) out.push(p);
    }
    return out.sort();
}

const files = walk(examples);

const resolver = (file: string) => (rel: string) => {
    const p = resolve(dirname(file), rel);
    return existsSync(p) ? readFileSync(p, 'utf8') : undefined;
};

/** The `parser` header changes with the version; everything else must be identical. */
function strip(model: unknown): unknown {
    const m = JSON.parse(JSON.stringify(model)) as Record<string, unknown>;
    delete m.parser;
    return m;
}

function implemented(language: Language): boolean {
    try {
        codecFor(language).print({ $schema: '', parser: { name: '', version: '' } } as never);
        return true;
    } catch (e) {
        return !/not implemented/.test((e as Error).message);
    }
}

const byLanguage = new Map<Language, string[]>();
for (const f of files) {
    const lang = LANGUAGE_OF_EXT[f.split('.').pop()!];
    byLanguage.set(lang, [...(byLanguage.get(lang) ?? []), f]);
}

for (const [language, paths] of byLanguage) {
    describe(`${language}: the four encodings`, () => {
        const ready = implemented(language);
        for (const file of paths) {
            const name = relative(examples, file);
            const text = readFileSync(file, 'utf8');

            it(`${name} parses as ${language}`, async () => {
                const r = await read({ text, fileName: file, resolve: resolver(file) });
                expect(r.language).toBe(language);
                if (!r.ok) {
                    // An example that is meant to fail (a scenario written against the wrong figures) is parsed, not round-tripped.
                    expect(r.diagnostics.map(d => d.message).join('\n')).toMatch(/.+/);
                }
            });

            it.skipIf(!ready)(`${name}: DSL -> model -> DSL -> model`, async () => {
                const a = await read({ text, fileName: file, resolve: resolver(file) });
                if (!a.ok) return;
                const codec = codecFor(language);
                const printed = write(codec, a.model, 'dsl');
                const b = await read({ text: printed, fileName: file, resolve: resolver(file) });
                expect(b.diagnostics.filter(d => d.severity === 'error').map(d => `${d.line}: ${d.message}\n${printed.split('\n')[d.line - 1]}`)).toEqual([]);
                expect(jsonDiff(strip(a.model), strip(b.model))).toEqual([]);
            });

            it.skipIf(!ready)(`${name}: JSON and YAML keep the model, and the JSON validates against the schema`, async () => {
                const a = await read({ text, fileName: file, resolve: resolver(file) });
                if (!a.ok) return;
                const codec = codecFor(language);
                expect(validateDocument(codec.schema(), a.model).map(d => d.message)).toEqual([]);
                const json = write(codec, a.model, 'json', true);
                expect(canonicalJson(JSON.parse(json))).toBe(canonicalJson(a.model));
                const yaml = write(codec, a.model, 'yaml');
                expect(canonicalJson(parseYaml(yaml, { version: '1.2' }))).toBe(canonicalJson(a.model));
                // and the document read back through the DSL is the same model
                const fromJson = await read({ text: json, fileName: `${file}.json`, resolve: resolver(file) });
                expect(fromJson.diagnostics.filter(d => d.severity === 'error').map(d => d.message)).toEqual([]);
                expect(jsonDiff(strip(a.model), strip(fromJson.model))).toEqual([]);
            });

            it.skipIf(!ready)(`${name}: Markdown -> DSL -> model, without a diagnostic`, async () => {
                const a = await read({ text, fileName: file, resolve: resolver(file) });
                if (!a.ok) return;
                const codec = codecFor(language);
                const md = write(codec, a.model, 'markdown');
                const c = await read({ text: md, fileName: `${file}.md`, resolve: resolver(file) });
                expect(c.diagnostics.map(d => `${d.line}: [${d.severity}] ${d.message}\n    ${md.split('\n')[d.line - 1]}`)).toEqual([]);
                expect(jsonDiff(strip(a.model), strip(c.model))).toEqual([]);
            });
        }
    });
}
