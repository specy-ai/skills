// =============================================================================
// Tree-sitter grammar for Specy Software Architecture (.arch)
// C4-inspired (Context / Container / Component), Thrift-inspired typed
// contracts, ports + connectors, first-class async channels.
// Faithful translation of src/grammars/architecture.ebnf.
// =============================================================================

module.exports = grammar({
  name: 'specy_architecture',

  extras: $ => [/\s/, $.comment],

  word: $ => $.identifier,

  rules: {

    // =========================================================================
    // Top-level
    // =========================================================================

    source_file: $ => repeat($.architecture_def),

    architecture_def: $ => seq(
      'architecture',
      field('name', choice($.type_name, $.string_literal)),
      optional($.description),
      optional($.metadata_block),
      '{',
      repeat($._architecture_member),
      '}',
    ),

    _architecture_member: $ => choice(
      $.domain_source_decl,
      $.requirements_source_decl,
      $.person_def,
      $.external_system_def,
      $.system_def,
    ),

    // =========================================================================
    // Provenance
    // =========================================================================

    domain_source_decl: $ => seq('domain-source', $.string_literal),

    requirements_source_decl: $ => seq('requirements-source', $.string_literal),

    // =========================================================================
    // Level 1 — System Context: persons and external systems
    // =========================================================================

    person_def: $ => seq(
      'person',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
    ),

    external_system_def: $ => seq(
      'externalSystem',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      optional($.realizes_decl),
      optional(seq(
        '{',
        repeat(choice($.provides_clause, $.consumes_clause)),
        '}',
      )),
    ),

    // =========================================================================
    // System — the one software system in focus
    // =========================================================================

    system_def: $ => seq(
      'system',
      field('name', choice($.type_name, $.string_literal)),
      optional($.description),
      optional($.metadata_block),
      optional($.satisfies_decl),
      optional($.realizes_decl),
      '{',
      repeat($._system_member),
      '}',
    ),

    _system_member: $ => choice(
      $._named_type_def,
      $.interface_def,
      $.bounded_context_decl,
      $.container_def,
      $.channel_def,
      $.connector_def,
      $.environment_def,
    ),

    // =========================================================================
    // Bounded Context
    // =========================================================================

    bounded_context_decl: $ => seq(
      'boundedContext',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
    ),

    // =========================================================================
    // Level 2 — Container
    // =========================================================================

    container_def: $ => seq(
      'container',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      optional($.technology_decl),
      optional($.satisfies_decl),
      optional($.realizes_decl),
      optional(seq(
        '{',
        repeat(choice($.provides_clause, $.requires_clause, $.component_def)),
        '}',
      )),
    ),

    technology_decl: $ => seq('technology', $.string_literal),

    // =========================================================================
    // Level 3 — Component
    // =========================================================================

    component_def: $ => seq(
      'component',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      optional($.satisfies_decl),
      optional($.realizes_decl),
      optional(seq(
        '{',
        repeat($._component_clause),
        '}',
      )),
    ),

    _component_clause: $ => choice(
      $.bounded_context_ref,
      $.provides_clause,
      $.requires_clause,
      $.publishes_clause,
      $.subscribes_clause,
    ),

    bounded_context_ref: $ => seq('boundedContext', field('name', $.type_name)),

    // =========================================================================
    // Ports
    // =========================================================================

    provides_clause: $ => seq('provides', field('interface', $.type_name)),
    requires_clause: $ => seq('requires', field('interface', $.type_name)),
    consumes_clause: $ => seq('consumes', field('interface', $.type_name)),

    // =========================================================================
    // Channel participation — async publish / subscribe
    // =========================================================================

    publishes_clause: $ => seq(
      'publishes',
      field('message', $.type_name),
      'to',
      field('channel', $.identifier),
    ),

    subscribes_clause: $ => seq('subscribes', field('channel', $.identifier)),

    // =========================================================================
    // Interface
    // =========================================================================

    interface_def: $ => seq(
      'interface',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      optional($.satisfies_decl),
      optional($.realizes_decl),
      '{',
      repeat($.operation_def),
      '}',
    ),

    // =========================================================================
    // Operation
    // =========================================================================

    operation_def: $ => seq(
      optional(field('style', $.operation_style)),
      field('name', $.identifier),
      '(',
      optional($.arg_list),
      ')',
      'returns',
      field('return', $.return_type),
      optional($.throws_clause),
      optional($.description),
      optional($.metadata_block),
    ),

    operation_style: $ => choice('safe', 'oneway', 'streaming'),

    return_type: $ => choice('void', $.field_type),

    throws_clause: $ => seq(
      'throws',
      '(',
      $.type_name,
      repeat(seq(',', $.type_name)),
      ')',
    ),

    // =========================================================================
    // Arguments — Thrift-style
    // =========================================================================

    arg_list: $ => seq(
      $.arg_decl,
      repeat(seq(',', $.arg_decl)),
    ),

    arg_decl: $ => seq(
      field('ordinal', $.ordinal),
      ':',
      field('requiredness', $.requiredness),
      field('type', $.field_type),
      field('name', $.identifier),
      optional(seq('=', field('default', $.literal_value))),
    ),

    // =========================================================================
    // Named types — Thrift-inspired
    // =========================================================================

    _named_type_def: $ => choice(
      $.struct_def,
      $.enum_def,
      $.typedef_def,
      $.union_def,
      $.exception_def,
      $.import_decl,
    ),

    struct_def: $ => seq(
      'struct',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      optional($.satisfies_decl),
      '{',
      $.field_def,
      repeat(choice($.field_def, $.comment)),
      '}',
    ),

    exception_def: $ => seq(
      'exception',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      $.field_def,
      repeat(choice($.field_def, $.comment)),
      '}',
    ),

    field_def: $ => seq(
      field('ordinal', $.ordinal),
      ':',
      field('requiredness', $.requiredness),
      field('type', $.field_type),
      field('name', $.identifier),
      optional(seq('=', field('default', $.literal_value))),
      optional($.description),
    ),

    union_def: $ => seq(
      'union',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      $.union_member,
      repeat(choice($.union_member, $.comment)),
      '}',
    ),

    union_member: $ => seq(
      field('ordinal', $.ordinal),
      ':',
      field('type', $.field_type),
      field('name', $.identifier),
    ),

    enum_def: $ => seq(
      'enum',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      $.enum_member,
      repeat(choice($.enum_member, $.comment)),
      '}',
    ),

    enum_member: $ => seq(
      field('name', $.identifier),
      '=',
      field('value', $.integer),
    ),

    typedef_def: $ => seq(
      'typedef',
      field('name', $.type_name),
      '=',
      field('type', $.field_type),
    ),

    import_decl: $ => seq(
      'import',
      $.import_kind,
      field('name', $.type_name),
      'from',
      'domain',
    ),

    import_kind: $ => choice(
      seq('value', 'type'),
      'event',
    ),

    requiredness: $ => choice('required', 'optional'),

    ordinal: $ => $.integer,

    // =========================================================================
    // Channel
    // =========================================================================

    channel_def: $ => seq(
      'channel',
      field('name', $.identifier),
      'on',
      field('broker', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      $.carries_clause,
      '}',
    ),

    carries_clause: $ => seq(
      'carries',
      $.type_name,
      repeat(seq(',', $.type_name)),
    ),

    // =========================================================================
    // Connector
    // =========================================================================

    connector_def: $ => seq(
      'connect',
      field('from', $.connector_ref),
      '->',
      field('to', $.connector_ref),
      'over',
      field('protocol', $.string_literal),
      field('style', $.connector_style),
      optional($.description),
      optional($.metadata_block),
    ),

    connector_ref: $ => seq(
      $.type_name,
      repeat(seq('.', $.type_name)),
    ),

    connector_style: $ => choice('sync', 'async', 'streaming'),

    // =========================================================================
    // Deployment view
    // =========================================================================

    environment_def: $ => seq(
      'environment',
      field('name', $.identifier),
      optional($.description),
      optional($.metadata_block),
      '{',
      repeat($.deploy_clause),
      '}',
    ),

    deploy_clause: $ => seq(
      'deploy',
      $.type_name,
      repeat(seq(',', $.type_name)),
      optional(seq('replicas', $.integer)),
    ),

    // =========================================================================
    // Realizes
    // =========================================================================

    realizes_decl: $ => seq(
      'realizes',
      $.realizes_ref,
      repeat(seq(',', $.realizes_ref)),
    ),

    realizes_ref: $ => choice(
      seq('module', field('module', $.domain_name)),
      seq('context', field('context', $.domain_name)),
      seq('interface', field('interface', $.type_name)),
      seq('event', field('event', $.type_name)),
      seq('value', 'type', field('value_type', $.type_name)),
    ),

    domain_name: $ => choice($.type_name, $.string_literal),

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

    requirement_id: $ => token(/[A-Z]+-[A-Z][A-Z0-9-]*-\d{3}/),

    // =========================================================================
    // Field types
    // =========================================================================

    field_type: $ => choice(
      $.primitive_type,
      $.collection_type,
      $.type_name,
    ),

    primitive_type: $ => choice(
      'string',
      'int', 'integer',
      'long',
      'double',
      'decimal',
      'boolean',
      'date',
      'datetime',
      'time',
      'instant',
      'duration',
      'uuid',
      'binary',
    ),

    collection_type: $ => seq(
      choice('list', 'set', 'map'),
      '<',
      $.field_type,
      optional(seq(',', $.field_type)),
      '>',
    ),

    // =========================================================================
    // Description & Metadata
    // =========================================================================

    description: $ => seq('::', $.string_literal),

    metadata_block: $ => seq('meta', '{', repeat($.metadata_entry), '}'),

    metadata_entry: $ => seq(
      field('key', $.identifier),
      '=',
      field('value', $.literal_value),
    ),

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

    boolean: $ => choice('true', 'false'),

    string_literal: $ => token(seq('"', /[^"]*/, '"')),

    number: $ => token(/-?\d+(\.\d+)?/),

    integer: $ => token(/-?\d+/),

    type_name: $ => token(/[A-Z][a-zA-Z0-9]*/),

    identifier: $ => token(/[a-z][a-zA-Z0-9]*/),

    // =========================================================================
    // Comments
    // =========================================================================

    comment: $ => token(seq('//', /[^\n]*/)),
  },
});
