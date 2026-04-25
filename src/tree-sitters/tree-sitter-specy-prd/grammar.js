// =============================================================================
// tree-sitter-specy-prd — grammar for the Specy PRD format (.prd)
// =============================================================================

module.exports = grammar({
  name: 'specy_prd',

  extras: $ => [
    /\s+/,
    $.comment,
  ],

  rules: {
    // -------------------------------------------------------------------------
    // Top-level
    // -------------------------------------------------------------------------

    source_file: $ => repeat(choice(
      $.product_def,
      $.comment,
    )),

    // -------------------------------------------------------------------------
    // Product — top-level container
    // -------------------------------------------------------------------------

    product_def: $ => seq(
      'product',
      field('name', $.string_literal),
      '{',
      repeat(choice(
        $.vision_decl,
        $.scope_block,
        $.non_goals_block,
        $.problem_block,
        $.evidence_def,
        $.persona_def,
        $.job_def,
        $.goal_def,
        $.hypothesis_def,
        $.feature_def,
        $.assumption_def,
        $.risk_def,
        $.constraint_def,
        $.open_question_def,
        $.release_def,
        $.journey_def,
      )),
      '}',
    ),

    // -------------------------------------------------------------------------
    // Vision
    // -------------------------------------------------------------------------

    vision_decl: $ => seq('vision', field('value', $.string_literal)),

    // -------------------------------------------------------------------------
    // Scope
    // -------------------------------------------------------------------------

    scope_block: $ => seq(
      'scope',
      '{',
      repeat1($.string_literal),
      '}',
    ),

    // -------------------------------------------------------------------------
    // Non-goals
    // -------------------------------------------------------------------------

    non_goals_block: $ => seq(
      'non-goals',
      '{',
      repeat1($.string_literal),
      '}',
    ),

    // -------------------------------------------------------------------------
    // Problem Statement — SCQ framework
    // -------------------------------------------------------------------------

    problem_block: $ => seq(
      'problem',
      '{',
      'situation', $.string_literal,
      'complication', $.string_literal,
      'question', $.string_literal,
      '}',
    ),

    // -------------------------------------------------------------------------
    // Supporting Evidence
    // -------------------------------------------------------------------------

    evidence_def: $ => seq(
      'evidence',
      field('name', $.string_literal),
      '{',
      'type', $.evidence_type,
      'summary', $.string_literal,
      'source-reference', $.string_literal,
      'date', $.date_literal,
      'confidence', $.confidence_level,
      'supports', $.string_literal,
      '}',
    ),

    evidence_type: $ => choice(
      'user-research',
      'analytics',
      'market-research',
      'customer-feedback',
      'domain-expertise',
    ),

    confidence_level: $ => choice('strong', 'moderate', 'weak'),

    // -------------------------------------------------------------------------
    // Persona
    // -------------------------------------------------------------------------

    persona_def: $ => seq(
      'persona',
      field('name', $.string_literal),
      '{',
      'role', $.string_literal,
      'goals', '{', repeat1($.string_literal), '}',
      'frustrations', '{', repeat1($.string_literal), '}',
      'context', $.string_literal,
      'weight', $.persona_weight,
      '}',
    ),

    persona_weight: $ => choice('primary', 'secondary', 'excluded'),

    // -------------------------------------------------------------------------
    // Job
    // -------------------------------------------------------------------------

    job_def: $ => seq(
      'job',
      field('name', $.string_literal),
      '{',
      'persona', $.string_literal,
      'statement', $.string_literal,
      'type', $.job_type,
      'importance', $.job_importance,
      'satisfaction', $.job_satisfaction,
      optional($.related_to_clause),
      optional($.desired_outcomes_block),
      '}',
    ),

    job_type: $ => choice('functional', 'emotional', 'social'),

    job_importance: $ => choice('critical', 'important', 'nice-to-have'),

    job_satisfaction: $ => choice('unserved', 'underserved', 'adequately-served', 'overserved'),

    related_to_clause: $ => seq(
      'related-to',
      $.string_literal,
      repeat(seq(',', $.string_literal)),
    ),

    desired_outcomes_block: $ => seq(
      'desired-outcomes',
      '{',
      repeat1($.desired_outcome_def),
      '}',
    ),

    desired_outcome_def: $ => seq(
      $.string_literal,
      '{',
      'importance', $.outcome_level,
      'current-satisfaction', $.outcome_level,
      '}',
    ),

    outcome_level: $ => choice('high', 'medium', 'low'),

    // -------------------------------------------------------------------------
    // Goal
    // -------------------------------------------------------------------------

    goal_def: $ => seq(
      'goal',
      field('name', $.string_literal),
      '{',
      'statement', $.string_literal,
      'horizon', $.goal_horizon,
      'owner', $.string_literal,
      repeat($.metric_block),
      '}',
    ),

    goal_horizon: $ => choice('short-term', 'mid-term', 'long-term'),

    metric_block: $ => seq(
      'metric',
      '{',
      'indicator', $.string_literal,
      'target', $.string_literal,
      optional(seq('baseline', $.string_literal)),
      'measurement', $.string_literal,
      '}',
    ),

    // -------------------------------------------------------------------------
    // Hypothesis
    // -------------------------------------------------------------------------

    hypothesis_def: $ => seq(
      'hypothesis',
      field('name', $.string_literal),
      '{',
      'intervention', $.string_literal,
      'expected-outcome', $.string_literal,
      'mechanism', $.string_literal,
      'validation-method', $.string_literal,
      'status', $.hypothesis_status,
      'proposes', $.string_literal,
      'predicts', $.string_literal,
      optional($.supported_by_clause),
      '}',
    ),

    hypothesis_status: $ => choice(
      'proposed', 'testing', 'validated', 'invalidated', 'inconclusive',
    ),

    supported_by_clause: $ => seq(
      'supported-by',
      $.string_literal,
      repeat(seq(',', $.string_literal)),
    ),

    // -------------------------------------------------------------------------
    // Feature
    // -------------------------------------------------------------------------

    feature_def: $ => seq(
      'feature',
      field('name', $.string_literal),
      '{',
      'summary', $.string_literal,
      'persona', $.string_literal,
      'value-proposition', $.string_literal,
      'priority', $.moscow_priority,
      'status', $.feature_status,
      optional($.addresses_clause),
      optional($.advances_clause),
      optional(seq('tested-by', $.string_literal)),
      optional($.design_references_block),
      optional($.non_goals_block),
      optional($.stories_block),
      '}',
    ),

    moscow_priority: $ => choice('must', 'should', 'could', 'wont'),

    feature_status: $ => choice(
      'proposed', 'accepted', 'in-progress',
      'delivered', 'deferred', 'rejected',
    ),

    addresses_clause: $ => seq(
      'addresses',
      $.string_literal,
      repeat(seq(',', $.string_literal)),
    ),

    advances_clause: $ => seq(
      'advances',
      $.string_literal,
      repeat(seq(',', $.string_literal)),
    ),

    // -------------------------------------------------------------------------
    // Design References
    // -------------------------------------------------------------------------

    design_references_block: $ => seq(
      'design-references',
      '{',
      repeat1($.design_reference),
      '}',
    ),

    design_reference: $ => seq(
      $.string_literal,
      '->',
      $.string_literal,
    ),

    // -------------------------------------------------------------------------
    // User Stories
    // -------------------------------------------------------------------------

    stories_block: $ => seq(
      'stories',
      '{',
      repeat1($.story_def),
      '}',
    ),

    story_def: $ => seq(
      $.string_literal,
      '{',
      'acceptance-criteria',
      '{',
      repeat1($.string_literal),
      '}',
      '}',
    ),

    // -------------------------------------------------------------------------
    // Assumption
    // -------------------------------------------------------------------------

    assumption_def: $ => seq(
      'assumption',
      field('name', $.string_literal),
      '{',
      'statement', $.string_literal,
      'impact-if-wrong', $.string_literal,
      'validation-plan', $.string_literal,
      'status', $.assumption_status,
      optional($.underpins_clause),
      '}',
    ),

    assumption_status: $ => choice('unvalidated', 'validated', 'invalidated'),

    underpins_clause: $ => seq(
      'underpins',
      $.string_literal,
      repeat(seq(',', $.string_literal)),
    ),

    // -------------------------------------------------------------------------
    // Risk
    // -------------------------------------------------------------------------

    risk_def: $ => seq(
      'risk',
      field('name', $.string_literal),
      '{',
      'statement', $.string_literal,
      'likelihood', $.likelihood_level,
      'impact', $.impact_level,
      'mitigation', $.mitigation_strategy,
      'owner', $.string_literal,
      optional($.threatens_clause),
      '}',
    ),

    likelihood_level: $ => choice('low', 'medium', 'high'),

    impact_level: $ => choice('low', 'medium', 'high', 'critical'),

    mitigation_strategy: $ => choice('accept', 'mitigate', 'avoid', 'transfer'),

    threatens_clause: $ => seq(
      'threatens',
      $.string_literal,
      repeat(seq(',', $.string_literal)),
    ),

    // -------------------------------------------------------------------------
    // Constraint
    // -------------------------------------------------------------------------

    constraint_def: $ => seq(
      'constraint',
      field('name', $.string_literal),
      '{',
      'statement', $.string_literal,
      'source', $.constraint_source,
      optional($.constrains_clause),
      '}',
    ),

    constraint_source: $ => choice(
      'regulatory', 'contractual', 'technical',
      'organizational', 'market',
    ),

    constrains_clause: $ => seq(
      'constrains',
      $.string_literal,
      repeat(seq(',', $.string_literal)),
    ),

    // -------------------------------------------------------------------------
    // Open Question
    // -------------------------------------------------------------------------

    open_question_def: $ => seq(
      'open-question',
      field('name', $.string_literal),
      '{',
      'question', $.string_literal,
      'context', $.string_literal,
      'owner', $.string_literal,
      'deadline', $.date_literal,
      'status', $.question_status,
      optional($.blocks_clause),
      optional(seq('resolution', $.string_literal)),
      '}',
    ),

    question_status: $ => choice('open', 'investigating', 'resolved', 'deferred'),

    blocks_clause: $ => seq(
      'blocks',
      $.string_literal,
      repeat(seq(',', $.string_literal)),
    ),

    // -------------------------------------------------------------------------
    // Release
    // -------------------------------------------------------------------------

    release_def: $ => seq(
      'release',
      field('name', $.string_literal),
      '{',
      // any subset of fields, in any order
      repeat(choice(
        seq('target-date', $.string_literal),
        seq('theme', $.string_literal),
        seq('status', $.release_status),
        $.depends_on_clause,
        $.includes_block,
        $.entry_criteria_block,
        $.exit_criteria_block,
      )),
      '}',
    ),

    release_status: $ => choice('planned', 'in-progress', 'shipped', 'cancelled'),

    depends_on_clause: $ => seq(
      'depends-on',
      $.string_literal,
      repeat(seq(',', $.string_literal)),
    ),

    includes_block: $ => seq(
      'includes',
      '{',
      repeat1($.string_literal),
      '}',
    ),

    entry_criteria_block: $ => seq(
      'entry-criteria',
      '{',
      repeat1($.string_literal),
      '}',
    ),

    exit_criteria_block: $ => seq(
      'exit-criteria',
      '{',
      repeat1($.string_literal),
      '}',
    ),

    // -------------------------------------------------------------------------
    // Journey
    // -------------------------------------------------------------------------

    journey_def: $ => seq(
      'journey',
      field('name', $.string_literal),
      'for',
      field('persona', $.string_literal),
      '{',
      'trigger', $.string_literal,
      'outcome', $.string_literal,
      optional($.design_references_block),
      optional($.steps_block),
      '}',
    ),

    steps_block: $ => seq(
      'steps',
      '{',
      repeat1($.step_def),
      '}',
    ),

    step_def: $ => seq(
      optional('step'),
      // step name doubles as action when no `action` keyword is present
      field('name', choice($.string_literal, $.integer)),
      '{',
      // any subset of fields, in any order
      repeat(choice(
        seq('action', $.string_literal),
        seq('system-response', $.string_literal),
        seq('channel', $.channel_type),
        seq('emotional-tone', $.emotional_tone),
        seq('order', $.integer),
      )),
      '}',
    ),

    channel_type: $ => choice(
      'app', 'web', 'sms', 'email',
      'physical', 'backoffice', 'external',
    ),

    emotional_tone: $ => choice(
      'confident', 'anxious', 'frustrated',
      'delighted', 'neutral',
    ),

    // -------------------------------------------------------------------------
    // Literals
    // -------------------------------------------------------------------------

    string_literal: $ => token(seq(
      '"',
      /([^"\\]|\\.)*/,
      '"',
    )),

    date_literal: $ => /\d{4}-\d{2}-\d{2}/,

    integer: $ => token(seq(
      optional('-'),
      /\d+/,
    )),

    // -------------------------------------------------------------------------
    // Comments
    // -------------------------------------------------------------------------

    comment: $ => token(choice(
      seq('//', /[^\n]*/),
      seq('#', /[^\n]*/),
      seq('/*', /([^*]|\*+[^*\/])*\*+\//),
    )),
  },
});
