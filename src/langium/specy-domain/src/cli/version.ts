/**
 * Version of the parser and of the clean JSON it emits. Bumped whenever the
 * shape of `specy-domain parse` output changes in a way consumers must know
 * about (1.1.0: `kind` discriminators on ambiguous expression and clause nodes,
 * and this header; 1.2.0: the `specy-synth` scenario parser; 1.3.0: scenario JSON
 * opens with `$schema`, and `specy-synth parse -f yaml`; 1.4.0: compound rate
 * predicates, share `given`, reaction-latency and rejections; 1.5.0: given
 * columns, `vocabulary` and `distributions`). Consumers such as synthy
 * pin the minimum they accept.
 */
export const PARSER_VERSION = '1.5.0';

/**
 * The JSON Schema of the scenario document (`src/schemas/synth-scenario.schema.json`
 * at the root of specy-skill). The trailing number is the format's major version.
 */
export const SYNTH_SCENARIO_SCHEMA = 'https://specy.ai/schemas/synth-scenario/1.json';
