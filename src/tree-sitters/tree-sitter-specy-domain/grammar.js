// =============================================================================
// Tree-sitter grammar for Specy Domain Model (.domain)
// =============================================================================

module.exports = grammar({
  name: 'specy_domain',

  extras: $ => [/\s/, $.comment],

  word: $ => $.identifier,

  conflicts: $ => [
    [$.named_arg, $._path_segment],
    [$._path_segment, $.literal_value],
    [$.field_decl],
    [$.function_name, $._path_segment],
  ],

  rules: {

    // =========================================================================
    // Top-level
    // =========================================================================

    source_file: $ => repeat(choice(
      $.organization_def,
      $.context_def,
      $.module_def,
      $._definition,
    )),

    // =========================================================================
    // Organization
    // =========================================================================

    organization_def: $ => seq(
      'organization',
      field('name', choice($.type_name, $.string_literal)),
      optional($.description),
      optional($.metadata_block),
      '{',
      repeat(choice($.requirements_source_decl, $.prd_source_decl)),
      repeat($.context_def),
      '}',
    ),

    // =========================================================================
    // Bounded Context
    // =========================================================================

    context_def: $ => seq(
      'context',
      field('name', choice($.type_name, $.string_literal)),
      optional($.shortname),
      optional($.description),
      optional($.metadata_block),
      '{',
      repeat(choice($.requirements_source_decl, $.prd_source_decl)),
      optional($.context_map_block),
      repeat(choice($.module_def, $._definition)),
      '}',
    ),

    shortname: $ => choice(
      seq('shortname', $.identifier),
      seq('shortname', '(', $.identifier, ')'),
      seq('(', $.identifier, ')'),
    ),

    requirements_source_decl: $ => seq('requirements-source', $.string_literal),

    prd_source_decl: $ => seq('prd-source', $.string_literal),

    // =========================================================================
    // Context Map
    // =========================================================================

    context_map_block: $ => seq(
      'map', '{',
      repeat($.context_relation),
      '}',
    ),

    context_relation: $ => choice(
      $.upstream_relation,
      $.downstream_relation,
      $.symmetric_relation,
    ),

    upstream_relation: $ => seq('upstream', $.type_name, ':', $.upstream_pattern),
    downstream_relation: $ => seq('downstream', $.type_name, ':', $.downstream_pattern),
    symmetric_relation: $ => seq('symmetric', $.type_name, ':', $.symmetric_pattern),

    upstream_pattern: $ => 'OHS',
    downstream_pattern: $ => choice('CS', 'Conformist', 'ACL'),
    symmetric_pattern: $ => choice('SharedKernel', 'PublishedLanguage', 'Partnership', 'SeparateWays'),

    // =========================================================================
    // Module
    // =========================================================================

    module_def: $ => seq(
      'module',
      field('name', choice($.type_name, $.string_literal)),
      optional($.description),
      optional($.metadata_block),
      repeat($.uses_decl),
      repeat($.requirements_source_decl),
      optional($.module_body),
    ),

    module_body: $ => seq(
      '{',
      optional($.depends_block),
      repeat(choice($.module_def, $.interface_def, $._definition)),
      '}',
    ),

    uses_decl: $ => seq('uses', 'module', $.type_name),

    depends_block: $ => seq('depends', 'on', '{', repeat(choice($.type_name, $.string_literal)), '}'),

    // =========================================================================
    // Interface
    // =========================================================================

    interface_def: $ => seq(
      'interface',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      repeat(choice($.exposes_clause, $.named_operation_def)),
      '}',
    ),

    exposes_clause: $ => seq('exposes', $.dot_path),

    // =========================================================================
    // Definitions
    // =========================================================================

    _definition: $ => choice(
      $.enum_def,
      $.value_def,
      $.entity_def,
      $.aggregate_def,
      $.statemachine_def,
      $.command_def,
      $.query_def,
      $.event_def,
      $.external_event_def,
      $.error_event_def,
      $.temporal_event_def,
      $.domain_service_def,
      $.application_service_def,
      $.infrastructure_service_def,
      $.service_def,
      $.invariant_def,
      $.agreement_def,
      $.reaction_def,
    ),

    // =========================================================================
    // Enum (top-level named enum)
    // =========================================================================

    enum_def: $ => seq(
      'enum',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      repeat1($.enum_value),
      '}',
    ),

    enum_value: $ => seq($.identifier, optional(',')),

    // Inline enum block (inside value body, no name)
    inline_enum_block: $ => seq(
      'enum',
      '{',
      $.type_name,
      repeat(seq(',', $.type_name)),
      optional(','),
      '}',
    ),

    // =========================================================================
    // Satisfies
    // =========================================================================

    satisfies_decl: $ => seq(
      'satisfies',
      '[',
      $.requirement_id,
      repeat(seq(',', $.requirement_id)),
      ']',
    ),

    requirement_id: $ => token(/REQ-[A-Z][A-Z0-9]*(-[A-Z][A-Z0-9]*)*-\d{3}/),

    // =========================================================================
    // Value Type — flexible body (with or without fields{} wrapper)
    // =========================================================================

    value_def: $ => seq(
      'value',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      repeat($._value_body_item),
      '}',
    ),

    _value_body_item: $ => choice(
      $.satisfies_decl,
      $.description,
      $.field_decl,
      $.fields_block,
      $.inline_enum_block,
      $.inline_invariant,
      $.invariants_block,
      $.value_operations_block,
    ),

    value_operations_block: $ => seq(
      'operations', '{',
      repeat($.value_op_def),
      '}',
    ),

    value_op_def: $ => seq(
      field('name', $.identifier),
      '(',
      optional($.param_list),
      ')',
      ':',
      $.field_type,
      optional($.description),
      optional($.metadata_block),
    ),

    // =========================================================================
    // Entity — flexible body
    // =========================================================================

    entity_def: $ => seq(
      'entity',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      repeat($._entity_body_item),
      '}',
    ),

    _entity_body_item: $ => choice(
      $.satisfies_decl,
      $.description,
      $.field_decl,
      $.fields_block,
      $.identity_decl,
      $.duplicate_detection,
      $.named_operation_def,
      $.operations_block,
      $.inline_invariant,
      $.invariants_block,
      $.reactions_block,
      $.states_block,
      $.transitions_block,
      $.references_block,
    ),

    identity_decl: $ => seq(
      choice('identity', 'identifier'),
      field('name', $.identifier),
      ':',
      $.field_type,
    ),

    duplicate_detection: $ => seq('duplicate', 'detection', '{', $.expression, '}'),

    // =========================================================================
    // Aggregate — flexible body
    // =========================================================================

    aggregate_def: $ => seq(
      'aggregate',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      choice(
        // long form: aggregate X { root Y; entities { ... }; ... }
        seq('{', repeat($._aggregate_body_item), '}'),
        // short form: aggregate X root Y                          (no body)
        // short form: aggregate X root Y { contains [E1, E2] }    (contains-only body)
        seq(
          'root', field('root', $.type_name),
          optional(seq('{', $.aggregate_contains_decl, '}')),
        ),
      ),
    ),

    _aggregate_body_item: $ => choice(
      $.satisfies_decl,
      $.description,
      $.aggregate_root_decl,
      $.aggregate_entities_decl,
      $.aggregate_contains_decl,
      $.identity_decl,
      $.duplicate_detection,
      $.field_decl,
      $.fields_block,
      $.references_block,
      $.invariants_block,
      $.reactions_block,
      $.operations_block,
      $.states_block,
      $.transitions_block,
    ),

    aggregate_root_decl: $ => seq('root', field('root', $.type_name)),

    aggregate_entities_decl: $ => seq('entities', '{', repeat($.type_name), '}'),

    aggregate_contains_decl: $ => choice(
      // bare comma list: contains E1, E2, E3
      seq('contains', $.type_name, repeat(seq(',', $.type_name))),
      // bracketed list: contains [E1, E2, E3]
      seq('contains', '[', $.type_name, repeat(seq(',', $.type_name)), ']'),
    ),

    // =========================================================================
    // Statemachine
    // =========================================================================

    statemachine_def: $ => seq(
      'statemachine',
      field('name', $.type_name),
      // optional 'on EntityName' header form: `statemachine X on Entity { ... }`
      optional(seq('on', field('entity', $.type_name))),
      '{',
      repeat($._statemachine_item),
      '}',
    ),

    _statemachine_item: $ => choice(
      $.on_clause,
      $.statemachine_start,
      $.state_def_simple,
      $.transition_inline,
      $.final_state,
    ),

    // State names may be PascalCase (canonical) or camelCase (also used).
    _state_name: $ => choice($.type_name, $.identifier),

    statemachine_start: $ => seq('start', $._state_name),

    state_def_simple: $ => seq(
      'state',
      field('name', $._state_name),
      // optional empty body and empty/identifier-named invariants
      optional(seq(
        '{',
        repeat(choice($.inline_invariant, $.inline_invariant_simple, $.scoped_invariant_def)),
        '}',
      )),
    ),

    // Simple inline invariant: `invariant <ident> { <expression> }`
    // (Used inside `state { ... }` and elsewhere where a full inline_invariant
    // with must_block / message / etc. would be heavy.)
    inline_invariant_simple: $ => seq(
      'invariant',
      field('name', $.identifier),
      optional($.description),
      optional(seq('enforcement', choice('reject', 'warn', 'rejection', 'compensation', 'alert'))),
      '{',
      optional($.satisfies_decl),
      $.expression,
      '}',
    ),

    transition_inline: $ => seq(
      'transition',
      field('from', $._state_name),
      '->',
      field('to', $._state_name),
      // accept either `triggered-by "string"` (canonical) or `on CommandOrEvent` (Specy v3 idiom)
      choice(
        seq('triggered-by', field('trigger', $.string_literal)),
        seq('on', field('trigger', $.type_name)),
      ),
    ),

    final_state: $ => seq('final', $._state_name),

    // =========================================================================
    // Reaction
    // =========================================================================

    reaction_def: $ => seq(
      'reaction',
      // url-shortener uses string-literal names; ride-now uses identifier names
      field('name', choice($.identifier, $.type_name, $.string_literal)),
      // scoped-guard form (formerly `policy name(params) { expr }`) carries typed params
      optional(seq('(', optional($.param_list), ')')),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      // Either clause items (triggered-by/trigger/effects/effect/guard) or a single
      // bare guard expression (the scoped-reaction form, formerly `policy name { expr }`).
      choice(
        repeat($._reaction_item),
        $.expression,
      ),
      '}',
    ),

    _reaction_item: $ => choice(
      $.description,
      $.triggered_by_clause,
      $.trigger_clause,
      $.guard_clause,
      $.effects_clause,
      $.effect_clause,
    ),

    triggered_by_clause: $ => seq('triggered-by', $.type_name),
    effects_clause: $ => seq('effects', $.type_name),

    // ride-now style: singular `trigger` / `effect` / explicit `guard`
    trigger_clause: $ => seq('trigger', $.type_name),
    guard_clause: $ => seq('guard', $.expression),
    effect_clause: $ => seq(
      'effect',
      choice(
        // effect publish EventName(args) [to OtherContext]
        seq('publish',
            $.type_name,
            optional(seq('(', optional($.arg_list), ')')),
            optional(seq('to', $.type_name))),
        $.service_call_expr,
        $.function_call,
        $.type_name,
      ),
    ),

    // =========================================================================
    // Named Operation (inline in entity/service/interface bodies)
    // =========================================================================

    named_operation_def: $ => seq(
      'operation',
      field('name', $.string_literal),
      '{',
      repeat($._named_op_item),
      '}',
    ),

    _named_op_item: $ => choice(
      $.satisfies_decl,
      $.description,
      $.on_clause,
      $.accepts_clause,
      $.returns_decl,
      $.emits_clause,
      $.named_precondition,
      $.named_postcondition,
    ),

    on_clause: $ => seq('on', $.type_name),

    accepts_clause: $ => seq(
      'accepts',
      $.param_decl_opt,
      repeat(seq(',', $.param_decl_opt)),
    ),

    param_decl_opt: $ => seq(
      field('name', $.identifier),
      ':',
      $.field_type_opt,
    ),

    field_type_opt: $ => seq($.field_type, optional('?')),

    returns_decl: $ => seq('returns', $.field_type_opt),

    emits_clause: $ => seq(
      'emits',
      $.type_name,
      optional(seq('{', repeat($.assignment_clause), '}')),
    ),

    named_precondition: $ => seq(
      'precondition',
      field('name', $.string_literal),
      '{',
      $.expression,
      optional(seq('violation', $.string_literal)),
      '}',
    ),

    named_postcondition: $ => seq(
      'postcondition',
      field('name', $.string_literal),
      '{',
      $.expression,
      '}',
    ),

    // =========================================================================
    // Inline Invariant (inside value/entity bodies)
    // =========================================================================

    inline_invariant: $ => seq(
      'invariant',
      field('name', $.string_literal),
      '{',
      optional($.satisfies_decl),
      optional($.description),
      optional($.on_clause),
      optional($.must_block),
      optional(seq('message', $.string_literal)),
      optional(seq('enforcement', choice('reject', 'warn', 'rejection', 'compensation', 'alert'))),
      '}',
    ),

    must_block: $ => seq('must', '{', $.expression, '}'),

    // Opaque body for predicate blocks authored as freeform business prose
    // (GAP-006). Excludes braces so it stops at the closing `}`.
    text_predicate: $ => token(prec(-1, /[^{}]+/)),

    // =========================================================================
    // Fields & References
    // =========================================================================

    fields_block: $ => seq('fields', '{', repeat($.field_decl), '}'),

    field_decl: $ => seq(
      field('name', $._field_name),
      ':',
      $.field_type_opt,
      repeat($.constraint),
      optional(choice(';', ',')),
    ),

    _field_name: $ => choice(
      $.identifier,
      'required',
      'optional',
      'value',
      'type',
      'status',
      'id',
    ),

    field_type: $ => choice(
      $.primitive_type,
      $.collection_type,
      $.generic_type,
      $.type_name,
    ),

    primitive_type: $ => choice(
      'string', 'int', 'integer', 'long', 'decimal', 'boolean', 'date', 'datetime', 'time', 'duration',
      'uuid', 'void', 'bytes', 'any',
    ),

    collection_type: $ => seq(
      choice('list', 'set', 'map'),
      '<',
      $.field_type,
      optional(seq(',', $.field_type)),
      '>',
    ),

    // Handles List<T>, Map<K,V>, Set<T> (PascalCase collection names)
    generic_type: $ => seq(
      $.type_name,
      '<',
      $.field_type,
      optional(seq(',', $.field_type)),
      '>',
    ),

    constraint: $ => choice(
      'required',
      'optional',
      'unique',
      'immutable',
      'ordered',
      seq('default', '(', $.literal_value, ')'),
      seq('min', '(', $.number, ')'),
      seq('max', '(', $.number, ')'),
      seq('range', '(', $.number, ',', $.number, ')'),
      seq('minLength', '(', $.number, ')'),
      seq('maxLength', '(', $.number, ')'),
      seq('pattern', '(', $.string_literal, ')'),
      seq('format', '(', $.identifier, ')'),
      'past',
      'future',
      'pastOrPresent',
      'futureOrPresent',
    ),

    references_block: $ => seq('references', '{', repeat($.reference_decl), '}'),

    reference_decl: $ => seq(
      field('name', $.identifier),
      ':',
      $.type_name,
      $.cardinality,
    ),

    cardinality: $ => token(/\d+\.\.\d+|\d+\.\.N/),

    // =========================================================================
    // Operations (classic block-based, for business-loan format)
    // =========================================================================

    operations_block: $ => seq('operations', '{', repeat($.operation_def), '}'),

    operation_def: $ => choice(
      $.command_triggered_op,
      $.event_triggered_op,
      $.internal_op,
    ),

    command_triggered_op: $ => seq(
      field('label', $.string_literal),
      'on',
      field('command', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      repeat($._operation_clause),
      '}',
    ),

    event_triggered_op: $ => seq(
      field('label', $.string_literal),
      'when',
      field('event', $.type_name),
      'then',
      field('command', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      repeat($._operation_clause),
      '}',
    ),

    internal_op: $ => seq(
      field('name', choice($.identifier, $.string_literal)),
      '(',
      optional($.param_list),
      ')',
      optional(seq(':', $.field_type)),
      optional($.description),
      optional($.metadata_block),
      optional(seq('{',
        optional($.satisfies_decl),
        repeat($._operation_clause),
      '}')),
    ),

    _operation_clause: $ => choice(
      $.precondition_clause,
      $.postcondition_clause,
      $.resolves_clause,
      $.reaction_call_clause,
      $.reaction_def,
      $.creates_clause,
      $.sets_clause,
      $.emits_clause,
      $.service_call_clause,
      $.foreach_clause,
      $.returns_clause,
    ),

    // =========================================================================
    // Operation Clauses
    // =========================================================================

    precondition_clause: $ => seq(
      'precondition',
      field('name', $.identifier),
      optional($.description),
      optional($.metadata_block),
      '{',
      // multi-line bodies are conjunctions of expressions, implicit `and`
      $.expression,
      repeat($.expression),
      '}',
      optional(seq('rejects', $.string_literal)),
    ),

    postcondition_clause: $ => seq(
      'postcondition',
      field('name', $.identifier),
      optional($.description),
      optional($.metadata_block),
      '{',
      // multi-line bodies are conjunctions of expressions, implicit `and` between lines
      $.expression,
      repeat($.expression),
      '}',
    ),

    resolves_clause: $ => seq('resolves', $.type_name, 'from', $.dot_path),

    reaction_call_clause: $ => seq(
      'reaction',
      field('name', $.identifier),
      '(',
      optional($.arg_list),
      ')',
      optional($.description),
      optional($.metadata_block),
    ),

    creates_clause: $ => seq(
      'creates', $.type_name, '{',
      repeat($.assignment_clause),
      '}',
    ),

    sets_clause: $ => seq(
      'sets', $.type_name, '{',
      repeat($.assignment_clause),
      '}',
    ),

    assignment_clause: $ => seq(
      field('field', $.identifier),
      '=',
      $._value_expr,
      optional(choice(';', ',')),
    ),

    returns_clause: $ => choice(
      seq('returns', field('name', $.identifier), ':', $.field_type),
      seq('returns', $._value_expr),
    ),

    service_call_clause: $ => seq(
      $.dot_path,
      '(',
      optional($.arg_list),
      ')',
      optional($.description),
    ),

    foreach_clause: $ => seq(
      'foreach',
      $.dot_path,
      'as',
      $.identifier,
      '{',
      repeat(choice(
        $.resolves_clause,
        $.sets_clause,
        $.emits_clause,
        $.service_call_clause,
        $.reaction_call_clause,
      )),
      '}',
    ),

    // =========================================================================
    // State Machine (classic block-based)
    // =========================================================================

    states_block: $ => seq('states', '{', repeat($.state_machine_def), '}'),

    state_machine_def: $ => seq(
      'machine',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      repeat(choice($.state_def, $.transition_def)),
      '}',
    ),

    state_def: $ => seq(
      choice('state', 'final'),
      field('name', $.identifier),
      optional($.description),
      optional($.metadata_block),
      optional(seq('{', repeat($.state_invariant_def), '}')),
    ),

    state_invariant_def: $ => seq(
      'invariant',
      field('name', $.identifier),
      optional($.description),
      optional($.metadata_block),
      '{',
      $.expression,
      '}',
    ),

    transition_def: $ => seq(
      $.transition_source,
      '-->',
      field('target', $.identifier),
      'on',
      field('trigger', $.identifier),
      optional(seq('when', '{', $.expression, '}')),
      optional(seq('then', '{', $.expression, '}')),
    ),

    transition_source: $ => choice('[*]', $.identifier),

    // =========================================================================
    // Command — flexible body
    // =========================================================================

    command_def: $ => seq(
      'command',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      repeat($._record_body_item),
      '}',
    ),

    _record_body_item: $ => choice(
      $.satisfies_decl,
      $.description,
      $.field_decl,
      $.fields_block,
    ),

    // =========================================================================
    // Query — flexible body
    // =========================================================================

    query_def: $ => seq(
      'query',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      repeat($._query_body_item),
      '}',
    ),

    _query_body_item: $ => choice(
      $.satisfies_decl,
      $.description,
      $.field_decl,
      $.fields_block,
      $.returns_decl,
    ),

    // =========================================================================
    // Event — flexible body with type classifier
    // =========================================================================

    event_def: $ => seq(
      'event',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      repeat($._event_body_item),
      '}',
    ),

    _event_body_item: $ => choice(
      $.satisfies_decl,
      $.description,
      $.event_type_classifier,
      $.field_decl,
      $.fields_block,
      seq('schedule', $.string_literal),
      seq('instant', $.dot_path),
      seq('guard', '{', $.expression, '}'),
    ),

    event_type_classifier: $ => seq('type', choice('internal', 'external', 'error', 'temporal')),

    // =========================================================================
    // External Event
    // =========================================================================

    external_event_def: $ => seq(
      // accept both `external event` (two tokens) and `external-event` (one token)
      choice(seq('external', 'event'), 'external-event'),
      field('name', $.type_name),
      choice(
        // long form: [description] { satisfies, from X, triggers { Y, Z } }
        seq(
          optional($.description),
          optional($.metadata_block),
          '{',
          optional($.satisfies_decl),
          'from', $.type_name,
          optional(seq(
            'triggers', '{',
            $.type_name,
            repeat(seq(',', $.type_name)),
            '}',
          )),
          '}',
        ),
        // short form: external-event Name from Context  (no body)
        seq('from', field('source_context', $.type_name)),
      ),
    ),

    // =========================================================================
    // Error Event — flexible body
    // =========================================================================

    error_event_def: $ => seq(
      'error', 'event',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      repeat($._event_body_item),
      '}',
    ),

    // =========================================================================
    // Temporal Events
    // =========================================================================

    // Unified temporal-event — accepts relative, absolute, and recurring kinds
    // through item-based body, with both legacy and modern keyword spellings.
    temporal_event_def: $ => seq(
      // accept `temporal event` (two tokens) or `temporal-event` (single token)
      choice(seq('temporal', 'event'), 'temporal-event'),
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      repeat($._temporal_event_item),
      '}',
    ),

    _temporal_event_item: $ => choice(
      $.satisfies_decl,
      $.description,
      $.relative_to_clause,
      $.absolute_instant_clause,
      $.recurring_clause,
      $.guard_clause,           // un-braced  (also used in reactions)
      $.guard_clause_braced,    // braced     (legacy)
      $.fields_block,
    ),

    // `relative-to <Ref> offset <Duration>` (modern) and
    // `reference <Ref> offset <Value>` (legacy)
    // (dot_path subsumes a bare type_name as a single-segment path)
    relative_to_clause: $ => seq(
      choice('relative-to', 'reference'),
      choice($.dot_path, $.paren_expr),
      optional(seq('offset', $._value_expr)),
    ),

    absolute_instant_clause: $ => seq('instant', $.dot_path),

    // `recurring "<cron>" [per-market]` (modern) and
    // `schedule "<cron>"` (legacy)
    recurring_clause: $ => seq(
      choice('recurring', 'schedule'),
      $.string_literal,
      optional('per-market'),
    ),

    guard_clause_braced: $ => seq('guard', '{', $.expression, '}'),

    // =========================================================================
    // Services — flexible body
    // =========================================================================

    domain_service_def: $ => seq(
      choice('domain-service', seq('domain', 'service')),
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      repeat($._service_body_item),
      '}',
    ),

    application_service_def: $ => seq(
      choice('application-service', seq('application', 'service')),
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      repeat($._service_body_item),
      '}',
    ),

    infrastructure_service_def: $ => seq(
      choice('infrastructure-service', seq('infrastructure', 'service')),
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      repeat($._service_body_item),
      '}',
    ),

    service_def: $ => seq(
      'service',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      repeat($._service_body_item),
      '}',
    ),

    _service_body_item: $ => choice(
      $.satisfies_decl,
      $.description,
      $.named_operation_def,
      $.operations_block,
      $.interface_def,
      $.invariants_block,
      $.reactions_block,
    ),

    service_op_def: $ => seq(
      field('name', choice($.identifier, $.string_literal)),
      '(',
      optional($.param_list),
      ')',
      optional(seq(':', $.field_type)),
      optional($.description),
      optional($.metadata_block),
      optional(seq('{', optional($.satisfies_decl), repeat($._service_clause), '}')),
    ),

    _service_clause: $ => choice(
      $.foreach_clause,
      $.resolves_clause,
      $.service_call_clause,
      $.returns_clause,
      $.precondition_clause,
      $.postcondition_clause,
    ),

    // =========================================================================
    // Reaction (reactive rules) are defined by `reaction_def` above; the legacy
    // `policy` and scoped-`policy` forms were folded into it.

    // =========================================================================
    // Invariant (top-level)
    // =========================================================================

    invariant_def: $ => seq(
      'invariant',
      field('name', choice($.type_name, $.string_literal)),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      optional($.description),
      optional($.on_clause),
      optional($.must_block),
      optional(seq('message', $.string_literal)),
      optional(seq('enforcement', choice('reject', 'warn', 'rejection', 'compensation', 'alert'))),
      optional($.enforcement_strategy),
      '}',
    ),

    enforcement_strategy: $ => choice(
      'rejection',
      seq('compensation', $.type_name),
      'alert',
    ),

    invariants_block: $ => seq('invariants', '{', repeat($.scoped_invariant_def), '}'),

    reactions_block: $ => seq('reactions', '{', repeat($.scoped_invariant_def), '}'),

    // =========================================================================
    // Transitions (entity-level shorthand)
    // =========================================================================

    transitions_block: $ => seq('transitions', '{', repeat($.entity_transition), '}'),

    entity_transition: $ => seq(
      $.transition_source,
      '-->',
      field('target', $.identifier),
      'on',
      $.string_literal,
      repeat(seq(',', $.string_literal)),
    ),

    scoped_invariant_def: $ => seq(
      field('name', $.identifier),
      optional(seq('(', optional($.param_list), ')')),
      optional($.description),
      optional(seq('enforcement', choice('reject', 'warn', 'rejection', 'compensation', 'alert'))),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      $.expression,
      '}',
    ),

    // =========================================================================
    // Agreement
    // =========================================================================

    agreement_def: $ => seq(
      'agreement',
      field('name', choice($.type_name, $.string_literal)),
      optional($.description),
      optional($.metadata_block),
      '{',
      repeat($._agreement_item),
      '}',
    ),

    _agreement_item: $ => choice(
      $.satisfies_decl,
      $.description,
      $.participants_clause,
      $.predicate_block,
      $.reconciliation_def,
    ),

    participants_clause: $ => seq(
      'participants',
      choice(
        seq($.type_name, repeat(seq(',', $.type_name))),
        seq('[', $.type_name, repeat(seq(',', $.type_name)), ']'),
      ),
    ),

    // Agreement/reconciliation predicates are authored as freeform business
    // prose (GAP-006); parse the body as an opaque text_predicate and leave
    // semantic validation to the LSP/checker rather than erroring.
    predicate_block: $ => seq('predicate', '{', $.text_predicate, '}'),

    predicate_expr: $ => choice(
      $.forall_pred,
      $.expression,
    ),

    forall_pred: $ => seq(
      'forall',
      $.type_name,
      optional(seq('where', $.expression)),
      ':',
      choice($.exists_pred, $.expression),
    ),

    exists_pred: $ => seq(
      'exists',
      $.type_name,
      optional(seq('where', $.expression)),
    ),

    reconciliation_def: $ => seq(
      'reconciliation',
      // identifier-named reconciliations are common in ride-now style
      field('name', choice($.identifier, $.type_name, $.string_literal)),
      optional($.description),
      optional($.metadata_block),
      '{',
      repeat($._reconciliation_item),
      '}',
    ),

    _reconciliation_item: $ => choice(
      seq('trigger', $.reconciliation_trigger),
      seq('detection', $.detection_strategy),
      seq('response', $.identifier),                                    // new
      seq('compensation', $.type_name, repeat(seq(',', $.type_name))),
      seq('coordination', $.coordination_style),
      $.escalation_chain_def,
      $.escalation_list,                                                // new
    ),

    reconciliation_trigger: $ => choice(
      seq('event', $.type_name, repeat(seq(',', $.type_name))),
      seq('schedule', $.string_literal),
    ),

    // Detection strategy: a closed enum, OR a freeform predicate string.
    detection_strategy: $ => choice('query', 'event-sourced', 'query-based', $.string_literal),

    // Bracketed escalation list: `escalation [stepA, stepB]`
    escalation_list: $ => seq(
      'escalation', '[',
      $.identifier, repeat(seq(',', $.identifier)),
      ']',
    ),

    coordination_style: $ => choice('choreography', 'orchestration'),

    escalation_chain_def: $ => seq(
      'escalation',
      optional($.description),
      optional($.metadata_block),
      '{',
      repeat1($.escalation_step),
      '}',
    ),

    escalation_step: $ => seq(
      'step',
      field('name', choice($.identifier, $.number)),
      optional($.description),
      optional($.metadata_block),
      '{',
      repeat($._escalation_step_item),
      '}',
    ),

    _escalation_step_item: $ => choice(
      seq('condition', $.string_literal),
      seq('action', $.escalation_action),
      seq('max-attempts', $.number),
      seq('when', '{', $.expression, '}'),
      seq('then', '{', $.expression, '}'),
    ),

    escalation_action: $ => choice(
      seq('retry', optional(seq('(', $.number, ')'))),
      seq('compensate', choice(
        seq('{', $.type_name, repeat(seq(',', $.type_name)), '}'),
        $.type_name,
      )),
      seq('alert', optional($.string_literal)),
      'suspend',
      seq('manual', optional($.string_literal)),
      'manual-intervention',
    ),

    // =========================================================================
    // Parameters & Arguments
    // =========================================================================

    param_list: $ => seq(
      $.param_decl,
      repeat(seq(',', $.param_decl)),
    ),

    param_decl: $ => seq(
      field('name', $.identifier),
      ':',
      $.field_type,
    ),

    arg_list: $ => choice(
      seq($.expression, repeat(seq(',', $.expression))),
      $.named_arg_list,
    ),

    named_arg_list: $ => seq(
      $.named_arg,
      repeat(seq(',', $.named_arg)),
    ),

    named_arg: $ => seq($.identifier, '=', $._value_expr),

    // =========================================================================
    // Description & Metadata
    // =========================================================================

    description: $ => seq('::', $.string_literal),

    metadata_block: $ => seq('meta', '{', repeat($.metadata_entry), '}'),

    metadata_entry: $ => seq($.identifier, '=', $.literal_value),

    // =========================================================================
    // Expressions
    // =========================================================================

    expression: $ => $.coalesce_expr,

    // Elvis / null-coalescing: `a ?: b` evaluates to `b` when `a` is null.
    // Lowest binary precedence — binds looser than `or`/`and`/comparison.
    coalesce_expr: $ => prec.left(0, seq(
      $.or_expr,
      repeat(seq('?:', $.or_expr)),
    )),

    or_expr: $ => prec.left(1, seq($.and_expr, repeat(seq('or', $.and_expr)))),

    and_expr: $ => prec.left(2, seq($.not_expr, repeat(seq('and', $.not_expr)))),

    not_expr: $ => choice(
      prec(3, seq('not', $.comparison)),
      $.comparison,
    ),

    comparison: $ => prec.left(4, seq(
      $.add_expr,
      optional(choice(
        seq($.comp_op, $.add_expr),
        seq('matches', $.regex_literal),
        seq('does', 'not', 'contain', $.dot_path),
        seq('contains', $.dot_path),
      )),
      optional(seq('?', $._value_expr, ':', $._value_expr)),
    )),

    comp_op: $ => choice('=', '!=', '>', '<', '>=', '<='),

    add_expr: $ => prec.left(5, seq(
      $.mul_expr,
      repeat(seq(choice('+', '-'), $.mul_expr)),
    )),

    mul_expr: $ => prec.left(6, seq(
      $.unary_expr,
      repeat(seq(choice('*', '/'), $.unary_expr)),
    )),

    unary_expr: $ => prec(7, choice(
      $.if_expr,
      $.every_expr,
      $.quantifier_expr,
      $.no_field_contains_expr,
      $.is_defined_expr,
      $.is_not_defined_expr,
      $.is_null_expr,
      $.is_not_null_expr,
      $.in_expr,
      $.not_in_expr,
      $.service_call_expr,
      $.function_call,
      prec(10, $.duration_literal),
      $.dot_path,
      $.literal,
      $.paren_expr,
    )),

    // Quantifier inside expressions: `exists pm in paymentMethods where pm.isActive`
    quantifier_expr: $ => seq(
      choice('exists', 'forall'),
      field('var', $.identifier),
      'in',
      field('collection', $.dot_path),
      optional(seq('where', field('predicate', $.expression))),
    ),

    no_field_contains_expr: $ => seq('no', 'field', 'contains', $.dot_path),

    if_expr: $ => choice(
      // braced form: if <cond> { <then-expr> }
      seq('if', $.expression, '{', $.expression, '}'),
      // ternary form: if <cond> then <then-expr> else <else-expr>
      prec.right(seq('if', $.expression, 'then', $.expression, 'else', $.expression)),
    ),

    every_expr: $ => seq('every', $.type_name, 'in', $.dot_path, '{', $.expression, '}'),

    is_defined_expr: $ => prec(8, seq($.dot_path, 'is', 'defined')),
    is_not_defined_expr: $ => prec(8, seq($.dot_path, 'is', 'not', 'defined')),
    is_null_expr: $ => prec(8, seq($.dot_path, 'is', 'null')),
    is_not_null_expr: $ => prec(8, seq($.dot_path, 'is', 'not', 'null')),

    in_expr: $ => prec(8, seq($.dot_path, 'in', '{', $.value_list, '}')),
    not_in_expr: $ => prec(8, seq($.dot_path, 'not', 'in', '{', $.value_list, '}')),

    function_call: $ => seq(
      field('name', $.function_name),
      '(',
      optional($.arg_list),
      ')',
      // optional chained member access after the call: f().a, f().a.b, f()?.a
      repeat(seq(choice('.', '?.'), $._path_segment)),
    ),

    // function_name accepts the canonical built-ins plus any identifier or
    // type name — the latter covers domain helpers (`recompute`, `lookupX`)
    // and value-type constructors (`Money`, `AppealResolution`).
    function_name: $ => choice(
      'count', 'sum', 'now', 'today', 'size', 'isEmpty', 'isNotEmpty', 'append',
      $.identifier,
      $.type_name,
    ),

    paren_expr: $ => seq('(', $.expression, ')'),

    // Regex literal for 'matches' expressions: [a-zA-Z0-9-]+
    regex_literal: $ => token(/\[[^\]]*\][*+?]?/),

    // =========================================================================
    // Value expressions
    // =========================================================================

    _value_expr: $ => choice(
      $.service_call_expr,
      $.array_literal,
      $.expression,
    ),

    array_literal: $ => seq('[', $._value_expr, repeat(seq(',', $._value_expr)), ']'),

    service_call_expr: $ => prec(9, seq(
      $.dot_path,
      '(',
      optional($.arg_list),
      ')',
      // optional chained member access: Service.fn(args).result, Service.fn().a.b
      repeat(seq(choice('.', '?.'), $._path_segment)),
    )),

    value_list: $ => seq($._value_expr, repeat(seq(',', $._value_expr))),

    // =========================================================================
    // Dot-path
    // =========================================================================

    dot_path: $ => seq(
      $._path_segment,
      // accept both `.` (regular) and `?.` (safe-navigation) as separators
      repeat(seq(choice('.', '?.'), $._path_segment)),
    ),

    _path_segment: $ => seq(
      choice(
        $.identifier,
        $.type_name,
        $.string_literal,
        // Allow reserved keywords in dot-paths (e.g. DateTime.now())
        'now', 'today',
      ),
      optional($.array_index),
    ),

    array_index: $ => seq('[', $.expression, ']'),

    // =========================================================================
    // Literals & Identifiers
    // =========================================================================

    literal_value: $ => choice(
      $.string_literal,
      $.number,
      $.boolean,
      $.null_literal,
    ),

    null_literal: $ => 'null',

    literal: $ => $.literal_value,

    string_literal: $ => token(seq('"', /[^"]*/, '"')),

    number: $ => token(/-?\d+(\.\d+)?/),

    // Duration literal:
    //   - spaced: 24 months, 30 days, 1 year
    //   - compact: 60s, 5min, 24h, 30days, 1businessDay, 2businessDays
    //     (compact form uses token.immediate so the unit must be adjacent
    //      to the number — no whitespace allowed)
    duration_literal: $ => choice(
      seq($.number, choice('months', 'days', 'years', 'hours', 'minutes', 'seconds', 'weeks')),
      seq(
        $.number,
        token.immediate(/(?:businessDays|businessDay|seconds|minutes|months|hours|weeks|years|days|min|ms|s|h|d|w|y)/),
      ),
    ),

    boolean: $ => choice('true', 'false'),

    type_name: $ => token(/[A-Z][a-zA-Z0-9]*/),

    identifier: $ => token(/[a-zA-Z_][a-zA-Z0-9_]*/),

    // =========================================================================
    // Comments
    // =========================================================================

    comment: $ => token(choice(
      seq('//', /[^\n]*/),
      seq('#', /[^\n]*/),
      // C-style block comment — non-nesting
      seq('/*', /([^*]|\*+[^*\/])*\*+\//),
    )),
  },
});
