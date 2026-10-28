// =============================================================================
// Tree-sitter grammar for Specy Synthetic-Data Scenarios (.synth)
//
// Mirrors src/grammars/synth.ebnf — the normative grammar derived from
// src/metamodels/SYNTH-METAMODEL.md. Keep the two in sync.
//
// Highlighting only: cross-file resolution of the dot-paths into the .domain
// is the Langium language server's job (src/langium/specy-domain).
// =============================================================================

const KEYWORDS_AS_IDENT = [
  'count', 'per', 'by', 'rows', 'over', 'csv', 'json', 'alpha', 'decimals', 'dwell',
  'clock', 'seed', 'horizon', 'scenario', 'populations', 'outcomes', 'givens', 'options',
  'curve', 'total', 'share', 'mix', 'rate', 'rollup', 'exactly', 'from',
  'day', 'week', 'month', 'quarter', 'year', 'given', 'rejections',
  'vocabulary', 'locale', 'pack', 'words', 'distributions', 'uniform', 'lognormal', 'median', 'sigma', 'zipf',
  'since',
];

module.exports = grammar({
  name: 'specy_synth',

  extras: $ => [/\s/, $.comment],

  word: $ => $.identifier,

  rules: {

    // =========================================================================
    // Top-level: one scenario per file
    // =========================================================================

    source_file: $ => $.scenario_def,

    scenario_def: $ => seq(
      'scenario',
      field('name', $.scenario_name),
      optional($.description),
      '{',
      optional($.satisfies_decl),
      $.domain_source_decl,
      optional($.requirements_source_decl),
      optional($.seed_decl),
      optional($.horizon_decl),
      optional($.as_of_decl),
      $.populations_block,
      optional($.outcomes_block),
      optional($.givens_block),
      optional($.vocabulary_block),
      optional($.distributions_block),
      optional($.options_block),
      '}',
    ),

    scenario_name: $ => choice($.identifier, $.type_name),

    domain_source_decl: $ => seq('domain-source', field('path', $.string_literal)),

    requirements_source_decl: $ => seq('requirements-source', field('path', $.string_literal)),

    seed_decl: $ => seq('seed', choice($.number, $.string_literal)),

    horizon_decl: $ => seq('horizon', field('from', $.date_literal), '..', field('to', $.date_literal)),

    as_of_decl: $ => seq('as-of', field('instant', $.instant_literal)),

    date_literal: $ => choice($.date, $.string_literal),

    instant_literal: $ => choice($.date_time, $.date, $.string_literal),

    // =========================================================================
    // Populations
    // =========================================================================

    populations_block: $ => seq('populations', '{', repeat($.population_decl), '}'),

    population_decl: $ => seq(
      field('entity', $.entity_ref),
      choice(
        seq('count', field('count', $.number), optional(seq('since', field('since', $.date_literal)))),
        seq('per', field('parent', $.entity_ref), choice(seq('exactly', field('exactly', $.number)), field('range', $.cardinality))),
      ),
      optional(seq('clock', field('clock', $.member_ref))),
      optional($.description),
    ),

    // =========================================================================
    // Outcomes
    // =========================================================================

    outcomes_block: $ => seq('outcomes', '{', repeat($._outcome_decl), '}'),

    _outcome_decl: $ => choice(
      $.curve_outcome,
      $.total_outcome,
      $.share_outcome,
      $.mix_outcome,
      $.rate_outcome,
      $.rollup_outcome,
    ),

    outcome_name: $ => $.identifier,

    curve_outcome: $ => seq(
      'curve',
      optional(field('name', $.outcome_name)),
      field('measure', $.path),
      'by', field('by', $.path),
      'per', field('period', $.period),
      optional(seq('alpha', field('alpha', $.number))),
      optional($.description),
      '{',
      optional($.satisfies_decl),
      repeat($.curve_point),
      '}',
    ),

    curve_point: $ => seq(
      field('key', $.period_key), ':', field('value', $.number),
      optional(seq('over', field('rows', $.number), 'rows')),
      optional(','),
    ),

    total_outcome: $ => seq(
      'total',
      optional(field('name', $.outcome_name)),
      field('measure', $.path),
      '=', field('value', $.number),
      optional(seq('alpha', field('alpha', $.number))),
      optional($.description),
      optional($.satisfies_decl),
    ),

    share_outcome: $ => seq(
      'share',
      optional(field('name', $.outcome_name)),
      field('dimension', $.path),
      optional(seq('given', field('given', $.path))),
      optional($.description),
      '{',
      optional($.satisfies_decl),
      repeat(choice($.share_entry, $.share_group)),
      '}',
    ),

    share_entry: $ => seq(choice(field('member', $.member_ref), $.boolean), ':', $.fraction, optional(',')),

    share_group: $ => seq(choice(field('member', $.member_ref), $.boolean), ':', '{', repeat($.share_entry), '}', optional(',')),

    mix_outcome: $ => seq(
      'mix',
      optional(field('name', $.outcome_name)),
      field('machine', $.path),
      optional($.description),
      '{',
      optional($.satisfies_decl),
      repeat($.mix_entry),
      '}',
    ),

    mix_entry: $ => seq(field('state', $.state_ref), ':', $.fraction, optional(',')),

    rate_outcome: $ => seq(
      'rate',
      optional(field('name', $.outcome_name)),
      $._rate_expr,
      choice(
        seq(':', $.fraction, optional($.description), optional($.satisfies_decl)),
        seq(
          'by', field('by', $.path), 'per', field('period', $.period),
          optional($.description),
          '{', optional($.satisfies_decl), repeat($.rate_point), '}',
        ),
      ),
    ),

    _rate_expr: $ => choice($.rate_or, $.rate_and, $.rate_not, $.rate_group, $.rate_predicate),
    rate_or: $ => prec.left(1, seq($._rate_expr, 'or', $._rate_expr)),
    rate_and: $ => prec.left(2, seq($._rate_expr, 'and', $._rate_expr)),
    rate_not: $ => prec(3, seq('not', $._rate_expr)),
    rate_group: $ => seq('(', $._rate_expr, ')'),

    rate_predicate: $ => seq(field('path', $.path), optional(seq(choice('=', '!='), choice(field('member', $.member_ref), $.boolean)))),

    rate_point: $ => seq(field('key', $.period_key), ':', $.fraction, optional(',')),

    rollup_outcome: $ => seq(
      'rollup',
      optional(field('name', $.outcome_name)),
      field('total', $.path),
      'from', field('parts', $.path),
      optional($.description),
      optional($.satisfies_decl),
    ),

    // =========================================================================
    // Givens
    // =========================================================================

    givens_block: $ => seq('givens', '{', repeat($.given_decl), '}'),

    given_decl: $ => seq(
      field('entity', $.entity_ref),
      choice(
        seq('csv', field('csv', $.string_literal)),
        seq('json', field('json', $.string_literal)),
        seq('rows', '[', optional(seq($.row_literal, repeat(seq(optional(','), $.row_literal)))), ']'),
      ),
      optional($.description),
      optional(seq('{', repeat($.given_column), '}')),
    ),

    // a path within the given's entity and the file column it reads
    given_column: $ => seq(
      seq($.member_ref, repeat(seq('.', $.member_ref))),
      'from',
      field('source', $.string_literal),
      optional(','),
    ),

    row_literal: $ => seq('{', optional(seq($.row_entry, repeat(seq(optional(','), $.row_entry)))), '}'),

    row_entry: $ => seq(field('key', choice($.member_name, $.string_literal)), ':', field('value', $._row_value)),

    _row_value: $ => choice($.string_literal, $.number, $.boolean, $.null, $.row_literal, $.row_array),

    row_array: $ => seq('[', optional(seq($._row_value, repeat(seq(optional(','), $._row_value)))), ']'),

    null: $ => 'null',

    // =========================================================================
    // Options
    // =========================================================================

    // =========================================================================
    // Vocabulary and distributions
    // =========================================================================

    vocabulary_block: $ => seq(
      'vocabulary', '{',
      optional(seq('locale', field('locale', choice($.identifier, $.string_literal)))),
      optional(seq('pack', field('pack', $.string_literal))),
      repeat($.word_list),
      '}',
    ),

    word_list: $ => seq(
      field('field', $.path),
      'words',
      choice(
        field('file', $.string_literal),
        seq('[', optional(seq($.string_literal, repeat(seq(optional(','), $.string_literal)))), ']'),
      ),
      optional($.description),
    ),

    distributions_block: $ => seq('distributions', '{', repeat($.distribution), '}'),

    distribution: $ => seq(
      field('field', $.path),
      choice(
        field('shape', 'uniform'),
        seq(field('shape', 'lognormal'), optional(seq('median', field('median', $.number))), optional(seq('sigma', field('sigma', $.number)))),
        seq(field('shape', 'zipf'), optional(field('exponent', $.number))),
      ),
      optional($.description),
    ),

    options_block: $ => seq('options', '{', repeat($._option_entry), '}'),

    _option_entry: $ => choice(
      $.alpha_option,
      $.decimals_option,
      $.null_rate_option,
      $.default_dwell_option,
      $.dwell_block,
      $.reaction_latency_option,
      $.rejections_option,
    ),

    alpha_option: $ => seq('alpha', $.number),
    decimals_option: $ => seq('decimals', $.number),
    null_rate_option: $ => seq('null-rate', $.fraction),
    default_dwell_option: $ => seq('default-dwell', $.duration_text),
    reaction_latency_option: $ => seq('reaction-latency', $.duration_text),
    rejections_option: $ => seq('rejections', $.number),

    dwell_block: $ => seq('dwell', '{', repeat($.dwell_entry), '}'),

    dwell_entry: $ => seq(field('from', $.state_name), '-->', field('to', $.state_name), ':', $.duration_text, optional(',')),

    duration_text: $ => choice($.duration, $.string_literal),

    // =========================================================================
    // Dot-paths into the domain
    // =========================================================================

    path: $ => seq(field('root', $.entity_ref), repeat(seq('.', field('step', $.member_ref)))),

    entity_ref: $ => $.type_name,

    member_ref: $ => $.member_name,

    state_ref: $ => $.member_name,

    state_name: $ => $.member_name,

    member_name: $ => choice($.identifier, $.type_name, ...KEYWORDS_AS_IDENT),

    // =========================================================================
    // Shared with the domain grammar
    // =========================================================================

    description: $ => seq('::', $.string_literal),

    satisfies_decl: $ => seq('satisfies', '[', $.requirement_id, repeat(seq(',', $.requirement_id)), ']'),

    requirement_id: $ => token(/REQ-[A-Z][A-Z0-9]*(-[A-Z][A-Z0-9]*)*-\d{3}/),

    // =========================================================================
    // Literals & identifiers
    // =========================================================================

    period: $ => choice('day', 'week', 'month', 'quarter', 'year'),

    period_key: $ => choice($.period_literal, $.date, $.number),

    fraction: $ => seq($.number, optional('%')),

    boolean: $ => choice('true', 'false'),

    cardinality: $ => token(/\d+\.\.(\d+|[nN])/),

    // Longest match settles the overlaps: a date beats the number it starts
    // with, a duration beats its number, a date-time beats its date.
    date_time: $ => token(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?/),

    period_literal: $ => token(/\d{4}-(W\d{2}|Q[1-4])/),

    date: $ => token(/\d{4}-\d{2}(-\d{2})?/),

    duration: $ => token(/\d+(\.\d+)?(ms|min|s|h|d|w)/),

    number: $ => token(/-?\d+(\.\d+)?/),

    string_literal: $ => token(seq('"', /[^"]*/, '"')),

    type_name: $ => token(/[A-Z][a-zA-Z0-9]*/),

    identifier: $ => token(/[a-zA-Z_][a-zA-Z0-9_]*/),

    // =========================================================================
    // Comments
    // =========================================================================

    comment: $ => token(choice(
      seq('//', /[^\n]*/),
      seq('#', /[^\n]*/),
      seq('/*', /([^*]|\*+[^*\/])*\*+\//),
    )),
  },
});
