// =============================================================================
// Tree-sitter grammar for Specy Software Architecture (.arch)
// C4-inspired (Context / Container / Component), Thrift-inspired typed
// contracts, ports + connectors, first-class async channels, plus level 0
// (Organization): systems, the dependencies between them and their flows.
// Faithful translation of src/grammars/architecture.ebnf.
// =============================================================================

module.exports = grammar({
  name: 'specy_architecture',

  extras: $ => [/\s/, $.comment],

  word: $ => $.identifier,

  rules: {

    // =========================================================================
    // Top-level — two alternative roots:
    //   architecture — one system in focus (levels 1 to 3)
    //   organization — several systems and their dependencies (level 0)
    // =========================================================================

    source_file: $ => repeat(choice($.architecture_def, $.organization_def)),

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
    // Level 0 — Organization: systems, areas, phases, dependencies, flows
    //
    // Every rule of this section is reachable from organization_def alone. A
    // system or an external system declared in an organization has its OWN rule
    // (organization_system_def, organization_external_system_def), so
    // architecture_def, system_def and external_system_def accept exactly what
    // they accepted before level 0: no level-0 clause, no dependency, no phase.
    //
    // The level-0 words are contextual, not reserved. Lowercase ones are
    // keywords of the `word` token: where the parser does not expect them they
    // are lexed as identifiers. The PascalCase pattern tokens are lexed as such
    // only after the `:` of a dependency; everywhere else they are type names.
    // =========================================================================

    organization_def: $ => seq(
      'organization',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      '{',
      repeat($._organization_member),
      '}',
    ),

    _organization_member: $ => choice(
      $.domain_source_decl,
      $.requirements_source_decl,
      $.phase_def,
      $.area_def,
      $.person_def,
      $.organization_external_system_def,
      $.organization_system_def,
      $.dependency_def,
    ),

    phase_def: $ => seq(
      'phase',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
    ),

    area_def: $ => seq(
      'area',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
    ),

    // external_system_def plus the concepts it masters.
    organization_external_system_def: $ => seq(
      'externalSystem',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      optional($.realizes_decl),
      optional(seq(
        '{',
        repeat(choice($.provides_clause, $.consumes_clause, $.masters_clause)),
        '}',
      )),
    ),

    // No body: a black box. Level-0 clauses first, then the members of
    // system_def (inline detail, levels 2 to 3).
    organization_system_def: $ => seq(
      'system',
      field('name', $.type_name),
      optional($.description),
      optional($.metadata_block),
      optional($.technology_decl),
      optional($.satisfies_decl),
      optional($.realizes_decl),
      optional(seq(
        '{',
        repeat($._level0_clause),
        repeat($._system_member),
        '}',
      )),
    ),

    // used-by / masters / handles may be repeated; area and detailed-in at most
    // once — a validation rule, not a grammar rule.
    _level0_clause: $ => choice(
      $.area_ref,
      $.used_by_clause,
      $.masters_clause,
      $.handles_clause,
      $.hotspot_def,
      $.detailed_in_decl,
    ),

    area_ref: $ => seq('area', field('name', $.type_name)),

    used_by_clause: $ => seq(
      'used-by',
      $.type_name,
      repeat(seq(',', $.type_name)),
    ),

    masters_clause: $ => seq(
      'masters',
      $.concept_ref,
      repeat(seq(',', $.concept_ref)),
    ),

    handles_clause: $ => seq(
      'handles',
      $.concept_ref,
      repeat(seq(',', $.concept_ref)),
    ),

    detailed_in_decl: $ => seq('detailed-in', $.string_literal),

    hotspot_def: $ => seq(
      'hotspot',
      field('name', $.type_name),
      $.description,
      optional($.metadata_block),
      optional($.concerns_clause),
    ),

    concerns_clause: $ => seq(
      'concerns',
      $._concern_ref,
      repeat(seq(',', $._concern_ref)),
    ),

    _concern_ref: $ => choice($.flow_number, $.concept_ref),

    // [Context.]Concept
    concept_ref: $ => seq(
      optional(seq(field('context', $.type_name), '.')),
      field('name', $.type_name),
    ),

    // =========================================================================
    // Dependency — `A -> B`: A (downstream) depends on B (upstream)
    // =========================================================================

    dependency_def: $ => seq(
      'dependency',
      field('downstream', $.type_name),
      '->',
      field('upstream', $.type_name),
      optional(seq(
        ':',
        $._dependency_pattern,
        repeat(seq(',', $._dependency_pattern)),
      )),
      optional($.criticality_decl),
      optional($.description),
      optional($.metadata_block),
      optional(seq(
        '{',
        repeat($.flow_def),
        '}',
      )),
    ),

    // Same node names as the context-map patterns of the .domain parser.
    _dependency_pattern: $ => choice(
      $.downstream_pattern,
      $.upstream_pattern,
      $.symmetric_pattern,
    ),

    downstream_pattern: $ => choice('CS', 'Conformist', 'ACL'),
    upstream_pattern: $ => 'OHS',
    symmetric_pattern: $ => choice('SharedKernel', 'PublishedLanguage', 'Partnership'),

    criticality_decl: $ => seq('criticality', $.criticality),

    criticality: $ => choice('critical', 'degraded', 'tolerant'),

    // =========================================================================
    // Flow — a numbered movement of domain concepts along a dependency
    // =========================================================================

    flow_def: $ => seq(
      'flow',
      field('number', $.flow_number),
      field('label', $.string_literal),
      optional($.description),
      optional($.metadata_block),
      'carries',
      $.carried_concept,
      repeat(seq(',', $.carried_concept)),
      optional(seq('to', field('receiver', $.type_name))),
      optional(choice($.mechanism, $.phased_mechanisms)),
    ),

    flow_number: $ => token(/\d+/),

    carried_concept: $ => seq(
      field('concept', $.concept_ref),
      optional(seq('as', field('becomes', $.concept_ref))),
    ),

    mechanism: $ => choice(
      seq('over', field('medium', $.string_literal), optional($.transfer_mode)),
      $.transfer_mode,
    ),

    transfer_mode: $ => choice('manual', 'automated'),

    // At least one entry; an entry always states a mechanism.
    phased_mechanisms: $ => seq('{', repeat1($.phased_mechanism), '}'),

    phased_mechanism: $ => seq('phase', field('phase', $.type_name), $.mechanism),

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
    // System — the one software system in focus of an `architecture` file
    // (a system declared in an organization is organization_system_def)
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
    // Deployment view — environments, nodes, resources
    // =========================================================================

    environment_def: $ => seq(
      'environment',
      field('name', $.identifier),
      optional($.description),
      optional($.metadata_block),
      '{',
      repeat(choice($.deploy_clause, $.node_def)),
      '}',
    ),

    deploy_clause: $ => seq(
      'deploy',
      $.type_name,
      repeat(seq(',', $.type_name)),
      optional(seq('replicas', $.integer)),
    ),

    // Each attribute at most once, any order — a validation rule, not a grammar rule.
    node_def: $ => seq(
      'node',
      field('name', $.identifier),
      optional($.description),
      optional($.metadata_block),
      repeat($._node_attribute),
      '{',
      repeat(choice($.node_def, $.deploy_clause, $.resource_def)),
      '}',
    ),

    _node_attribute: $ => choice(
      $.provider_decl,
      $.region_decl,
      $.zone_decl,
    ),

    provider_decl: $ => seq('provider', $.string_literal),
    region_decl: $ => seq('region', $.string_literal),
    zone_decl: $ => seq('zone', $.string_literal),

    resource_def: $ => seq(
      'resource',
      field('name', $.identifier),
      optional($.description),
      optional($.metadata_block),
      optional($.instantiates_decl),
      optional($.technology_decl),
      optional($.tenancy_decl),
      optional(seq(
        '{',
        $.stores_clause,
        '}',
      )),
    ),

    instantiates_decl: $ => seq('instantiates', field('container', $.type_name)),

    tenancy_decl: $ => seq('tenancy', $.tenancy),

    tenancy: $ => choice('shared', 'dedicated'),

    stores_clause: $ => seq(
      'stores',
      $.type_name,
      repeat(seq(',', $.type_name)),
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
