// =============================================================================
// Tree-sitter grammar for Specy Domain Model (.domain)
//
// Mirrors src/grammars/domain.ebnf — the normative grammar derived from
// src/metamodels/DOMAIN-METAMODEL.md. Keep the two in sync.
// =============================================================================

module.exports = grammar({
  name: 'specy_domain',

  extras: $ => [/\s/, $.comment],

  word: $ => $.identifier,

  conflicts: $ => [
    [$.named_arg, $._path_segment],
    [$._path_segment, $.literal_value],
    [$.field_decl],
  ],

  rules: {

    // =========================================================================
    // Top-level
    //
    // Outer containers (organization > context > module) may be ELIDED: a file
    // may start at a context, a module, or a bare definition.
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
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      optional($.requirements_source_decl),
      repeat1($.context_def),
      '}',
    ),

    requirements_source_decl: $ => seq('requirements-source', $.string_literal),

    // =========================================================================
    // Bounded Context
    // =========================================================================

    context_def: $ => seq(
      'context',
      field('name', $.type_name),
      optional($.shortname),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      optional($.requirements_source_decl),
      optional($.context_map_block),
      repeat(choice($.module_def, $._definition)),
      '}',
    ),

    shortname: $ => seq('(', $.identifier, ')'),

    // =========================================================================
    // Context Map
    // =========================================================================

    context_map_block: $ => seq('map', '{', repeat($.context_relation), '}'),

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
    //
    // The two interface relations are NOT symmetric and are declared apart:
    //   exposes    { ApiName }     — the public surface
    //   requires   { SpiName }     — the capabilities needed from outside
    //   depends on { ModuleName }  — other modules
    // =========================================================================

    module_def: $ => seq(
      'module',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      // When the outer containers are elided, the module IS the top level, so it
      // must be able to carry the requirements-source provenance link.
      optional($.requirements_source_decl),
      optional($.exposes_block),
      optional($.requires_block),
      optional($.depends_block),
      repeat($._definition),
      '}',
    ),

    exposes_block: $ => seq('exposes', '{', repeat1($.type_name), '}'),
    requires_block: $ => seq('requires', '{', repeat1($.type_name), '}'),
    depends_block: $ => seq('depends', 'on', '{', repeat1($.type_name), '}'),

    // =========================================================================
    // Definitions
    // =========================================================================

    _definition: $ => choice(
      $.enum_def,
      $.value_def,
      $.entity_def,
      $.read_only_entity_def,
      $.aggregate_def,
      $.command_def,
      $.query_def,
      $.event_def,
      $.external_event_def,
      $.error_event_def,
      $.temporal_event_def,
      $.domain_service_def,
      $.application_service_def,
      $.infrastructure_service_def,
      $.repository_def,
      $.interface_def,
      $.reaction_def,
      $.invariant_def,
      $.agreement_def,
    ),

    // =========================================================================
    // Interface — a port. Every interface declares its role.
    //
    //   api interface — DRIVING port. `exposes` SELECTS operations that already
    //                   exist on an entity/aggregate/domain or app service.
    //   spi interface — DRIVEN port. `describes` names the infrastructure service
    //                   or repository that fulfils the contract it DEFINES.
    // =========================================================================

    interface_def: $ => seq(
      field('role', $.interface_role),
      'interface',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      repeat($._interface_member),
      '}',
    ),

    interface_role: $ => choice('api', 'spi'),

    _interface_member: $ => choice(
      $.exposes_clause,
      $.describes_clause,
      $.operation_signature,
    ),

    exposes_clause: $ => seq('exposes', $.dot_path),

    describes_clause: $ => seq('describes', $.type_name),

    // A signature, with an optional body carrying only conditions.
    operation_signature: $ => seq(
      field('name', $.identifier),
      '(',
      optional($.param_list),
      ')',
      optional(seq(':', field('return_type', $.field_type))),
      optional($.description),
      optional($.metadata_block),
      optional(seq(
        '{',
        optional($.satisfies_decl),
        repeat($._condition_clause),
        '}',
      )),
    ),

    // =========================================================================
    // Satisfies — always the first element inside the body braces.
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
    // Enum (Referential)
    //
    // `of ValueType` — the enum holds instances of a value type, which must then
    // declare a `code` field.
    // =========================================================================

    enum_def: $ => seq(
      'enum',
      field('name', $.type_name),
      optional(seq('of', field('value_type', $.type_name))),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      repeat1($.enum_value),
      '}',
    ),

    enum_value: $ => seq(
      field('name', $.identifier),
      optional(seq('=', $.literal_value)),
      optional($.description),
      optional(','),
    ),

    // =========================================================================
    // Value Type
    // =========================================================================

    value_def: $ => seq(
      'value',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      $.fields_block,
      optional($.value_operations_block),
      optional($.invariants_block),
      '}',
    ),

    value_operations_block: $ => seq('operations', '{', repeat($.value_op_def), '}'),

    // A value operation returns a new value. Its body may carry the preconditions
    // of the "transactional constructor".
    value_op_def: $ => seq(
      field('name', $.identifier),
      '(',
      optional($.param_list),
      ')',
      ':',
      field('return_type', $.field_type),
      optional($.description),
      optional($.metadata_block),
      optional(seq(
        '{',
        optional($.satisfies_decl),
        optional($.safety_decl),
        optional($.idempotence_decl),
        repeat($._operation_clause),
        '}',
      )),
    ),

    // =========================================================================
    // Entity
    // =========================================================================

    entity_def: $ => seq(
      'entity',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      $.identity_decl,
      optional($.duplicate_detection),
      $.fields_block,
      optional($.references_block),
      optional($.operations_block),
      optional($.states_block),
      optional($.invariants_block),
      '}',
    ),

    identity_decl: $ => seq(
      'identity',
      field('name', $.identifier),
      ':',
      field('type', $.field_type),
    ),

    duplicate_detection: $ => seq('duplicate', 'detection', '{', $.expression, '}'),

    // =========================================================================
    // Read-only Entity (Master Data)
    //
    // State owned by an upstream context or external system. The operations block
    // admits only SAFE clauses — no sets / creates / emits — so "no unsafe
    // operations on master data" is enforced by the grammar, not a validator.
    // =========================================================================

    read_only_entity_def: $ => seq(
      'read-only',
      'entity',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      $.sourced_from_clause,
      optional($.synced_via_clause),
      optional($.projected_by_clause),
      $.identity_decl,
      $.fields_block,
      optional($.references_block),
      optional($.safe_operations_block),
      optional($.invariants_block),
      '}',
    ),

    sourced_from_clause: $ => seq('sourced-from', choice($.type_name, $.string_literal)),

    synced_via_clause: $ => seq('synced-via', $.sync_pattern),

    sync_pattern: $ => choice('synchronous-query', 'asynchronous-projection'),

    // The ACL adapter that refreshes the local read-model (asynchronous projection).
    projected_by_clause: $ => seq('projected-by', $.type_name),

    safe_operations_block: $ => seq('operations', '{', repeat($.safe_op_def), '}'),

    safe_op_def: $ => seq(
      field('name', $.identifier),
      '(',
      optional($.param_list),
      ')',
      optional(seq(':', field('return_type', $.field_type))),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      optional('safe'),
      repeat($._safe_operation_clause),
      '}',
    ),

    _safe_operation_clause: $ => choice(
      $.precondition_clause,
      $.postcondition_clause,
      $.resolves_clause,
      $.service_call_clause,
      $.safe_foreach_clause,
      $.returns_clause,
    ),

    safe_foreach_clause: $ => seq(
      'foreach', $.dot_path, 'as', field('var', $._binder),
      '{', repeat($._safe_operation_clause), '}',
    ),

    // =========================================================================
    // Aggregate
    //
    // An aggregate IS its root entity: it carries the identity, fields, operations,
    // states and invariants directly. There is no `root` clause. `entities { }`
    // lists the NON-ROOT children of the cluster.
    // =========================================================================

    aggregate_def: $ => seq(
      'aggregate',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      $.identity_decl,
      optional($.duplicate_detection),
      $.fields_block,
      $.aggregate_entities_decl,
      optional($.references_block),
      optional($.operations_block),
      optional($.states_block),
      optional($.invariants_block),
      '}',
    ),

    aggregate_entities_decl: $ => seq('entities', '{', repeat1($.type_name), '}'),

    // =========================================================================
    // Fields & References
    // =========================================================================

    fields_block: $ => seq('fields', '{', repeat($.field_decl), '}'),

    field_decl: $ => seq(
      field('name', $._field_name),
      ':',
      $.field_type_opt,
      repeat($.constraint),
      optional($.description),
      optional($.satisfies_decl),
    ),

    _field_name: $ => choice(
      $.identifier,
      'required', 'optional', 'value', 'type', 'status', 'id', 'code',
    ),

    field_type: $ => choice(
      $.primitive_type,
      $.collection_type,
      $.generic_type,
      $.type_name,
    ),

    field_type_opt: $ => seq($.field_type, optional('?')),

    primitive_type: $ => choice(
      'string', 'int', 'integer', 'long', 'decimal', 'boolean',
      'date', 'datetime', 'time', 'duration', 'uuid', 'void',
    ),

    collection_type: $ => seq(
      choice('list', 'set', 'map'),
      '<', $.field_type, optional(seq(',', $.field_type)), '>',
    ),

    generic_type: $ => seq(
      $.type_name,
      '<', $.field_type, optional(seq(',', $.field_type)), '>',
    ),

    // `code` marks the field by which an enum's value-type instances are referenced.
    constraint: $ => choice(
      'required',
      'optional',
      'unique',
      'immutable',
      'ordered',
      'code',
      seq('default', '(', $.literal_value, ')'),
      seq('min', '(', $.number, ')'),
      seq('max', '(', $.number, ')'),
      seq('range', '(', $.number, ',', $.number, ')'),
      seq('minLength', '(', $.number, ')'),
      seq('maxLength', '(', $.number, ')'),
      seq('pattern', '(', $.string_literal, ')'),
      'past',
      'future',
      'pastOrPresent',
      'futureOrPresent',
    ),

    references_block: $ => seq('references', '{', repeat($.reference_decl), '}'),

    reference_decl: $ => seq(
      field('name', $.identifier),
      ':',
      field('target', $.type_name),
      $.cardinality,
      optional($.description),
    ),

    cardinality: $ => token(/\d+\.\.(\d+|[nN])/),

    // =========================================================================
    // State Machine
    // =========================================================================

    states_block: $ => seq('states', '{', repeat($.state_machine_def), '}'),

    state_machine_def: $ => seq(
      'machine',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      repeat(choice($.state_def, $.transition_def)),
      '}',
    ),

    // A state carries its own invariants (which hold while the entity occupies it).
    state_def: $ => seq(
      field('kind', choice('state', 'final')),
      field('name', $.identifier),
      optional($.description),
      optional($.metadata_block),
      optional(seq(
        '{',
        optional($.satisfies_decl),
        optional($.invariants_block),
        '}',
      )),
    ),

    // `on` must be able to name EITHER operation form: an internal one (identifier)
    // or a command-triggered one (its "Label" string).
    //
    // Conditions on a transition are named and 0..n — a precondition declares its
    // violation reason, exactly as on an operation.
    transition_def: $ => seq(
      field('source', $.transition_source),
      '-->',
      field('target', $.identifier),
      'on',
      field('trigger', $.operation_ref),
      optional($.description),
      optional($.metadata_block),
      optional(seq(
        '{',
        optional($.satisfies_decl),
        repeat($._condition_clause),
        '}',
      )),
    ),

    transition_source: $ => choice('[*]', $.identifier),

    operation_ref: $ => choice($.identifier, $.string_literal),

    // =========================================================================
    // Operations
    //
    // Two forms only. There is NO event-triggered form: an event reaches a command
    // only through a `reaction`.
    // =========================================================================

    operations_block: $ => seq('operations', '{', repeat($.operation_def), '}'),

    operation_def: $ => choice($.command_triggered_op, $.internal_op),

    command_triggered_op: $ => seq(
      field('label', $.string_literal),
      'on',
      field('command', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      optional($.safety_decl),
      optional($.idempotence_decl),
      repeat($._operation_clause),
      '}',
    ),

    internal_op: $ => seq(
      field('name', $.identifier),
      '(',
      optional($.param_list),
      ')',
      optional(seq(':', field('return_type', $.field_type))),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      optional($.safety_decl),
      optional($.idempotence_decl),
      repeat($._operation_clause),
      '}',
    ),

    // safe = no mutation, read-only.  unsafe = mutates domain state.
    safety_decl: $ => choice('safe', 'unsafe'),

    idempotence_decl: $ => 'idempotent',

    _operation_clause: $ => choice(
      $.precondition_clause,
      $.postcondition_clause,
      $.resolves_clause,
      $.creates_clause,
      $.sets_clause,
      $.emits_clause,
      $.service_call_clause,
      $.foreach_clause,
      $.returns_clause,
    ),

    // =========================================================================
    // Conditions — precondition and postcondition
    //
    // A precondition's enforcement is implicit and always rejection, so it declares
    // no strategy — but it MUST declare a violation reason (`rejects`).
    // A postcondition has neither: its failure is a defect, not a domain outcome.
    // =========================================================================

    _condition_clause: $ => choice($.precondition_clause, $.postcondition_clause),

    precondition_clause: $ => seq(
      'precondition',
      field('name', $.condition_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      $.expression,
      repeat($.expression),   // multi-line bodies are an implicit conjunction
      '}',
      'rejects',
      field('reason', $.string_literal),
    ),

    postcondition_clause: $ => seq(
      'postcondition',
      field('name', $.condition_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      $.expression,
      repeat($.expression),
      '}',
    ),

    condition_name: $ => choice($.identifier, $.string_literal),

    // =========================================================================
    // Operation body clauses
    // =========================================================================

    resolves_clause: $ => seq('resolves', $.type_name, 'from', $.dot_path),

    creates_clause: $ => seq('creates', $.type_name, '{', repeat($.assignment_clause), '}'),

    sets_clause: $ => seq('sets', $.type_name, '{', repeat($.assignment_clause), '}'),

    // `emits` is the concrete syntax of the event's 1..1 "raised by" relation.
    emits_clause: $ => seq(
      'emits',
      $.type_name,
      optional(seq('{', repeat($.assignment_clause), '}')),
    ),

    assignment_clause: $ => seq(
      field('field', $.identifier),
      '=',
      $._value_expr,
      optional(choice(';', ',')),
    ),

    service_call_clause: $ => seq(
      $.dot_path, '(', optional($.arg_list), ')',
      optional($.description),
    ),

    returns_clause: $ => seq('returns', $._value_expr),

    foreach_clause: $ => seq(
      'foreach', $.dot_path, 'as', field('var', $._binder),
      '{', repeat($._operation_clause), '}',
    ),

    // =========================================================================
    // Command
    //
    // A command MUST carry an identifier — the correlation id of the causality
    // chain it opens.
    // =========================================================================

    command_def: $ => seq(
      'command',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      $.identity_decl,
      $.fields_block,
      '}',
    ),

    // =========================================================================
    // Query — safe and idempotent by definition; reads through a repository.
    // =========================================================================

    query_def: $ => seq(
      'query',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      $.reads_from_clause,
      $.fields_block,
      seq('returns', field('return_type', $.field_type)),
      '}',
    ),

    reads_from_clause: $ => seq('reads-from', field('repository', $.type_name)),

    // =========================================================================
    // Event (internal)
    //
    //   about     — the entity this event is a fact about
    //   caused-by — the command or query that originated it
    // =========================================================================

    event_def: $ => seq(
      'event',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      optional($.about_clause),
      optional($.caused_by_clause),
      $.fields_block,
      '}',
    ),

    about_clause: $ => seq('about', field('entity', $.type_name)),

    caused_by_clause: $ => seq('caused-by', field('cause', $.type_name)),

    // =========================================================================
    // External Event
    //
    // Consumed THROUGH A REACTION, exactly like an internal event. There is no
    // `triggers` clause naming commands directly — that would skip the reaction's
    // guard, which is what lets this context decide whether the upstream fact
    // still matters to it.
    // =========================================================================

    external_event_def: $ => seq(
      'external', 'event',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      seq('from', field('source', choice($.type_name, $.string_literal))),
      optional($.about_clause),
      $.fields_block,   // must carry an id — the correlation id
      '}',
    ),

    // =========================================================================
    // Error Event — raised by an operation on failure
    // =========================================================================

    error_event_def: $ => seq(
      'error', 'event',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      optional($.about_clause),
      optional($.caused_by_clause),
      $.fields_block,
      '}',
    ),

    // =========================================================================
    // Temporal Event — a domain fact caused by the passage of time.
    //
    // Time alone is never the cause: every temporal event is anchored to a domain
    // reference. `about` binds the entity whose state the guard reads.
    // =========================================================================

    temporal_event_def: $ => seq(
      'temporal', 'event',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      optional($.about_clause),
      field('anchor', $.temporal_anchor),
      optional($.guard_block),
      $.fields_block,
      '}',
    ),

    temporal_anchor: $ => choice(
      $.relative_anchor,
      $.absolute_anchor,
      $.recurring_anchor,
    ),

    relative_anchor: $ => seq(
      'reference', field('event', $.type_name),
      'offset', field('offset', $._value_expr),
    ),

    absolute_anchor: $ => seq('instant', field('instant', $.dot_path)),

    recurring_anchor: $ => seq('schedule', field('schedule', $.string_literal)),

    // Evaluated at firing time. If false the event is silently suppressed — no
    // fact is recorded and no reaction triggers. This absorbs cancellation.
    guard_block: $ => seq('guard', '{', $.expression, '}'),

    // =========================================================================
    // Services
    // =========================================================================

    domain_service_def: $ => seq(
      'domain', 'service',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      optional($.calls_block),
      $.operations_block,
      '}',
    ),

    // The infrastructure services this service depends on (through their SPIs).
    calls_block: $ => seq('calls', '{', repeat1($.type_name), '}'),

    application_service_def: $ => seq(
      'application', 'service',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      optional($.exposed_by_clause),
      $.operations_block,
      '}',
    ),

    exposed_by_clause: $ => seq('exposed-by', field('interface', $.type_name)),

    // An adapter fulfilling an SPI contract. The model records the SIGNATURES it
    // provides, never an adapter body.
    infrastructure_service_def: $ => seq(
      'infrastructure', 'service',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      optional($.described_by_clause),
      $.signature_operations_block,
      '}',
    ),

    described_by_clause: $ => seq('described-by', field('interface', $.type_name)),

    signature_operations_block: $ => seq('operations', '{', repeat($.operation_signature), '}'),

    // =========================================================================
    // Repository — a persistence port DERIVED from an entity or aggregate root.
    // A repository derived from a read-only entity is itself `read-only`.
    // =========================================================================

    repository_def: $ => seq(
      optional('read-only'),
      'repository',
      field('name', $.type_name),
      'for',
      field('entity', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      optional($.described_by_clause),
      repeat($.operation_signature),
      '}',
    ),

    // =========================================================================
    // Reaction — THE ONLY WAY AN EVENT CAUSES A COMMAND.
    //
    // Uniform across all four event types: internal, external, error, temporal.
    // =========================================================================

    reaction_def: $ => seq(
      'reaction',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      $.triggered_by_clause,
      optional($.guard_block),
      $.effects_clause,
      '}',
    ),

    triggered_by_clause: $ => seq(
      'triggered-by',
      field('event', $.type_name),
      repeat(seq(',', $.type_name)),
    ),

    effects_clause: $ => seq('effects', field('command', $.type_name)),

    // =========================================================================
    // Invariant — EVERY invariant declares its enforcement strategy.
    // =========================================================================

    invariant_def: $ => seq(
      'invariant',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      seq('on', field('scope', $.dot_path)),
      $.must_block,
      seq('enforcement', field('enforcement', $.enforcement_strategy)),
      '}',
    ),

    must_block: $ => seq('must', '{', $.expression, '}'),

    enforcement_strategy: $ => choice(
      'rejection',
      seq('compensation', $.type_name),
      'alert',
    ),

    invariants_block: $ => seq('invariants', '{', repeat($.scoped_invariant_def), '}'),

    // Inside an `invariants { }` block the owner is the enclosing entity,
    // aggregate, value type or state, so no `on` clause is needed.
    scoped_invariant_def: $ => seq(
      field('name', $.identifier),
      optional(seq('(', optional($.param_list), ')')),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      $.expression,
      seq('enforcement', field('enforcement', $.enforcement_strategy)),
      '}',
    ),

    // =========================================================================
    // Agreement — a property spanning several aggregates. Bilateral (2) or
    // multilateral (n) — never unilateral.
    // =========================================================================

    agreement_def: $ => seq(
      'agreement',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      $.participants_clause,
      $.predicate_block,
      $.reconciliation_def,
      '}',
    ),

    participants_clause: $ => seq(
      'participants', '{',
      $.type_name, ',', $.type_name,
      repeat(seq(',', $.type_name)),
      '}',
    ),

    predicate_block: $ => seq('predicate', '{', $.expression, '}'),

    // =========================================================================
    // Reconciliation — the enforcement counterpart of an agreement
    // =========================================================================

    reconciliation_def: $ => seq(
      'reconciliation',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      seq('trigger', $.reconciliation_trigger),
      seq('detection', $.detection_strategy),
      $.compensation_clause,
      optional(seq('coordination', $.coordination_style)),
      optional($.escalation_chain_def),
      '}',
    ),

    reconciliation_trigger: $ => choice(
      seq('event', $.type_name, repeat(seq(',', $.type_name))),
      seq('schedule', $.string_literal),
    ),

    detection_strategy: $ => choice('query', 'event-sourced'),

    compensation_clause: $ => seq(
      'compensation', '{',
      $.type_name, repeat(seq(',', $.type_name)),
      '}',
    ),

    coordination_style: $ => choice('choreography', 'orchestration'),

    // =========================================================================
    // Escalation Chain — MUST TERMINATE.
    //
    // The rule is encoded structurally rather than left to a validator: zero or
    // more non-terminal steps followed by exactly one terminal step. `retry` and
    // `compensate` can themselves fail, so they cannot end the chain.
    // =========================================================================

    escalation_chain_def: $ => seq(
      'escalation',
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      repeat($.non_terminal_step),
      $.terminal_step,
      '}',
    ),

    non_terminal_step: $ => seq(
      'step',
      field('name', $.identifier),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      seq('when', '{', $.expression, '}'),
      seq('action', field('action', $.non_terminal_action)),
      '}',
    ),

    terminal_step: $ => seq(
      'step',
      field('name', $.identifier),
      optional($.description),
      optional($.metadata_block),
      '{',
      optional($.satisfies_decl),
      seq('when', '{', $.expression, '}'),
      seq('action', field('action', $.terminal_action)),
      '}',
    ),

    non_terminal_action: $ => choice(
      seq('retry', '(', $.number, ')'),
      seq('compensate', '{', $.type_name, repeat(seq(',', $.type_name)), '}'),
    ),

    terminal_action: $ => choice(
      seq('alert', $.string_literal),
      'suspend',
      seq('manual', $.string_literal),
    ),

    // =========================================================================
    // Parameters & Arguments
    // =========================================================================

    param_list: $ => seq($.param_decl, repeat(seq(',', $.param_decl))),

    param_decl: $ => seq(
      field('name', $.identifier),
      ':',
      field('type', $.field_type),
      optional('?'),
    ),

    arg_list: $ => choice(
      seq($.expression, repeat(seq(',', $.expression))),
      $.named_arg_list,
    ),

    named_arg_list: $ => seq($.named_arg, repeat(seq(',', $.named_arg))),

    named_arg: $ => seq($.identifier, '=', $._value_expr),

    // =========================================================================
    // Description & Metadata
    // =========================================================================

    description: $ => seq('::', $.string_literal),

    metadata_block: $ => seq('meta', '{', repeat($.metadata_entry), '}'),

    metadata_entry: $ => seq($.identifier, '=', $.literal_value),

    // =========================================================================
    // Expressions
    //
    // Orthogonal to the metamodel, which only ever says "a predicate expression".
    // Precedence, loosest to tightest:
    //   ?:  <  or  <  and  <  not  <  comparison  <  + -  <  * /  <  unary
    // =========================================================================

    expression: $ => $.coalesce_expr,

    // Elvis / null-coalescing: `a ?: b` is `b` when `a` is null.
    coalesce_expr: $ => prec.left(0, seq($.or_expr, repeat(seq('?:', $.or_expr)))),

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
        seq('matches', choice($.string_literal, $.regex_literal)),
        seq('does', 'not', 'contain', $.dot_path),
        seq('contains', $.dot_path),
      )),
      optional(seq('?', $._value_expr, ':', $._value_expr)),
    )),

    comp_op: $ => choice('=', '!=', '>', '<', '>=', '<='),

    add_expr: $ => prec.left(5, seq($.mul_expr, repeat(seq(choice('+', '-'), $.mul_expr)))),

    mul_expr: $ => prec.left(6, seq($.unary_expr, repeat(seq(choice('*', '/'), $.unary_expr)))),

    unary_expr: $ => prec(7, choice(
      $.if_expr,
      $.every_expr,
      $.quantifier_expr,
      $.is_defined_expr,
      $.is_not_defined_expr,
      $.is_null_expr,
      $.is_not_null_expr,
      $.in_expr,
      $.not_in_expr,
      $.call_expr,
      prec(10, $.duration_literal),
      $.dot_path,
      $.literal,
      $.paren_expr,
    )),

    // if — logical implication (if A then B ≡ not A or B).
    if_expr: $ => choice(
      seq('if', $.expression, '{', $.expression, '}'),
      prec.right(seq('if', $.expression, 'then', $.expression, 'else', $.expression)),
    ),

    // every — universal quantifier. The binder is an identifier, matching
    // `foreach ... as <identifier>`.
    //
    // The binder accepts a type_name as well: the grammar's `identifier` is
    // camelCase OR PascalCase, so `every Product in lines` must parse even though
    // `Product` lexes as a type_name.
    every_expr: $ => seq('every', field('var', $._binder), 'in', $.dot_path, '{', $.expression, '}'),

    quantifier_expr: $ => seq(
      choice('exists', 'forall'),
      field('var', $._binder),
      'in',
      field('collection', $.dot_path),
      optional(seq('where', field('predicate', $.expression))),
    ),

    _binder: $ => choice($.identifier, $.type_name),

    is_defined_expr: $ => prec(8, seq($.dot_path, 'is', 'defined')),
    is_not_defined_expr: $ => prec(8, seq($.dot_path, 'is', 'not', 'defined')),
    is_null_expr: $ => prec(8, seq($.dot_path, 'is', 'null')),
    is_not_null_expr: $ => prec(8, seq($.dot_path, 'is', 'not', 'null')),

    in_expr: $ => prec(8, seq($.dot_path, 'in', '{', $.value_list, '}')),
    not_in_expr: $ => prec(8, seq($.dot_path, 'not', 'in', '{', $.value_list, '}')),

    // One production covers both a built-in function and a service call — they are
    // indistinguishable syntactically, and telling them apart needs a symbol table.
    //
    // Built-ins: count, sum, min, max, avg, abs, size, isEmpty, isNotEmpty,
    //            append, now, today.
    call_expr: $ => prec(9, seq(
      $.dot_path,
      '(',
      optional($.arg_list),
      ')',
      repeat(seq(choice('.', '?.'), $._path_segment)),
    )),

    paren_expr: $ => seq('(', $.expression, ')'),

    // Bracketed regex used by `matches`, e.g. [a-zA-Z0-9-]+
    regex_literal: $ => token(/\[[^\]]*\][*+?]?/),

    // =========================================================================
    // Value expressions
    // =========================================================================

    _value_expr: $ => choice($.array_literal, $.expression),

    array_literal: $ => seq('[', $._value_expr, repeat(seq(',', $._value_expr)), ']'),

    value_list: $ => seq($._value_expr, repeat(seq(',', $._value_expr))),

    // =========================================================================
    // Dot-path — `?.` is safe navigation; `[expr]` subscripts a collection.
    // =========================================================================

    dot_path: $ => seq(
      $._path_segment,
      repeat(seq(choice('.', '?.'), $._path_segment)),
    ),

    _path_segment: $ => seq(
      choice($.identifier, $.type_name, $.string_literal, 'now', 'today'),
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

    // Spaced form: `5 minutes`. Compact form: `5min`, `24h`, `2businessDays` —
    // token.immediate means the unit must be adjacent to the number.
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
      seq('/*', /([^*]|\*+[^*\/])*\*+\//),
    )),
  },
});
