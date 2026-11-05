/**
 * Version of the parser and of the clean JSON it emits. Bumped whenever the
 * shape of `specy-domain parse` output changes in a way consumers must know
 * about (1.1.0: `kind` discriminators on ambiguous expression and clause nodes,
 * and this header; 1.2.0: the `specy-synth` scenario parser; 1.3.0: scenario JSON
 * opens with `$schema`, and `specy-synth parse -f yaml`; 1.4.0: compound rate
 * predicates, share `given`, reaction-latency and rejections; 1.5.0: given
 * columns, `vocabulary` and `distributions`; 1.6.0: vocabulary `bindings`,
 * `Type as <kind>`; 1.7.0: the domain JSON opens with `$schema`, keeps the
 * `metadata` of operations, states, transitions and scoped invariants, marks
 * `null` literals and negated `contains` with a `kind`, and collapses the line
 * breaks of multi-line strings; the `specy` CLI converts every language between
 * DSL, JSON, YAML and Markdown; 1.8.0: conditional distribution rules (`when`),
 * the `among` shape and vocabulary `grammars`; 1.9.0: the `from` shape (a copy
 * through one declared reference, `source` in the JSON), and conditions and
 * grammar `by` that read through one declared reference). Consumers such as
 * synthy pin the minimum they accept.
 */
export const PARSER_VERSION = '1.9.0';

/**
 * The JSON Schema of the scenario document (`src/schemas/synth-scenario.schema.json`
 * at the root of specy-skill). The trailing number is the format's major version.
 */
export const SYNTH_SCENARIO_SCHEMA = 'https://specy.ai/schemas/synth-scenario/1.json';

/** The JSON Schemas of the other model documents (same folder, same versioning rule). */
export const DOMAIN_MODEL_SCHEMA = 'https://specy.ai/schemas/domain-model/1.json';
export const PRD_SCHEMA = 'https://specy.ai/schemas/prd/1.json';
export const SYSREQ_SCHEMA = 'https://specy.ai/schemas/sysreq/1.json';
export const ARCHITECTURE_SCHEMA = 'https://specy.ai/schemas/architecture/1.json';
