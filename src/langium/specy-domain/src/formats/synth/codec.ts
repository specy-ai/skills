/**
 * The .synth codec: the four encodings of a synthetic-data scenario, on the
 * parser and normalizer of this package (the scenario JSON synthy consumes),
 * the DSL printer and the Markdown writer and reader of this folder.
 *
 * Parsing resolves the scenario against the `.domain` it names with
 * `domain-source` — a companion the context provides (`companions`) or
 * resolves on demand (`resolve`, the CLI reads it next to the input). A
 * document that did not go through the DSL yet names it as `domain` (JSON,
 * YAML) or `domain:` in its front matter (Markdown): `companionOf` reads it so
 * the converter can load the file before parsing the printed DSL.
 */
import type { SynthFile } from '../../generated/ast.js';
import { normalizeScenario, type ScenarioJson } from '../../cli/synth-model.js';
import { SYNTH_SCENARIO_SCHEMA } from '../../cli/version.js';
import type { ModelCodec, ParseContext, ParseResult } from '../kit/codec.js';
import { parseText } from '../kit/parse.js';
import { SCHEMAS } from '../generated/schemas.js';
import { scenarioFromMarkdown, scenarioToMarkdown } from './markdown.js';
import { printScenario } from './printer.js';

export async function parseSynthText(text: string, ctx: ParseContext): Promise<ParseResult<ScenarioJson>> {
    const r = await parseText<SynthFile>(ctx.fileName, text, ctx, ast => ast.scenario?.domainSource?.path);
    const diagnostics = [...r.diagnostics];
    if (r.companion && r.companionFound === false) {
        diagnostics.unshift({
            severity: 'error',
            line: 1,
            column: 1,
            message: `domain-source "${r.companion}" was not found next to the scenario; its references cannot be resolved`,
            code: 'SYN-DOMAIN-SOURCE',
            source: 'parser',
        });
    }
    return { model: normalizeScenario(r.ast), diagnostics, ok: !diagnostics.some(d => d.severity === 'error') };
}

export const synthCodec: ModelCodec<ScenarioJson> = {
    language: 'synth',
    extension: '.synth',
    schemaId: SYNTH_SCENARIO_SCHEMA,
    schema: () => SCHEMAS.synth,
    parse: parseSynthText,
    print: printScenario,
    toMarkdown: scenarioToMarkdown,
    fromMarkdown: markdown => scenarioFromMarkdown(markdown),
    companionOf: (doc, header) => (typeof doc.domain === 'string' ? doc.domain : header?.domain ?? header?.['domain-source']),
};
