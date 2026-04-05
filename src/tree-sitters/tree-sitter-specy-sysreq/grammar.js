// =============================================================================
// tree-sitter-specy-sysreq — grammar for the Specy System Requirements (.sysreq)
// =============================================================================

module.exports = grammar({
  name: 'specy_sysreq',

  // Whitespace and line comments are transparent everywhere
  extras: $ => [
    /\s+/,
    $.comment,
  ],

  rules: {
    // -------------------------------------------------------------------------
    // Top-level
    // -------------------------------------------------------------------------

    source_file: $ => repeat($.requirement_set_def),

    // -------------------------------------------------------------------------
    // Requirement Set — groups requirements scoped to a bounded context
    // -------------------------------------------------------------------------

    requirement_set_def: $ => seq(
      'requirements',
      field('name', $.string_literal),
      'scoped-to',
      field('scope', $.type_name),
      '{',
      repeat(choice(
        $.prd_source_decl,
        $.module_block,
        $.requirement_def,
      )),
      '}',
    ),

    // -------------------------------------------------------------------------
    // PRD Source — provenance link to the product requirement file
    // -------------------------------------------------------------------------

    // -------------------------------------------------------------------------
    // Module — optional grouping of requirements within a set
    // -------------------------------------------------------------------------

    module_block: $ => seq(
      'module',
      field('name', $.string_literal),
      '{',
      repeat($.requirement_def),
      '}',
    ),

    prd_source_decl: $ => seq(
      'prd-source',
      field('path', $.string_literal),
    ),

    // -------------------------------------------------------------------------
    // Requirement — a named EARS statement with metadata
    // -------------------------------------------------------------------------

    requirement_def: $ => seq(
      field('id', $.requirement_id),
      field('name', $.string_literal),
      ':',
      field('pattern', $.ears_pattern),
      optional($.rationale),
      optional($.source_decl),
      field('statement', $.ears_statement),
      'priority',
      field('priority', $.moscow_priority),
      optional($.depends_on_decl),
      optional($.conflicts_with_decl),
      optional($.decomposed_into_block),
      optional($.satisfied_by_block),
    ),

    // -------------------------------------------------------------------------
    // Requirement ID — REQ-<SEGMENT>-<NUMBER>
    // -------------------------------------------------------------------------

    requirement_id: $ => /REQ-[A-Z][A-Z0-9-]*-\d{3}/,

    // -------------------------------------------------------------------------
    // EARS Patterns — the six requirement patterns
    // -------------------------------------------------------------------------

    ears_pattern: $ => choice(
      'ubiquitous',
      'state-driven',
      'event-driven',
      'unwanted',
      'optional',
      'complex',
    ),

    // -------------------------------------------------------------------------
    // EARS Statement — the full requirement sentence in quotes
    // -------------------------------------------------------------------------

    ears_statement: $ => $.string_literal,

    // -------------------------------------------------------------------------
    // Rationale — :: operator (same as domain model justification)
    // -------------------------------------------------------------------------

    rationale: $ => seq('::', field('text', $.string_literal)),

    // -------------------------------------------------------------------------
    // Priority — MoSCoW classification
    // -------------------------------------------------------------------------

    moscow_priority: $ => choice(
      'must',
      'should',
      'could',
      'wont',
    ),

    // -------------------------------------------------------------------------
    // Source — provenance reference to a PRD element
    // -------------------------------------------------------------------------

    source_decl: $ => seq(
      'source',
      field('reference', $.string_literal),
    ),

    // -------------------------------------------------------------------------
    // Depends-on — logical prerequisite between requirements
    // -------------------------------------------------------------------------

    depends_on_decl: $ => seq(
      'depends-on',
      $.requirement_id,
      repeat(seq(',', $.requirement_id)),
    ),

    // -------------------------------------------------------------------------
    // Conflicts-with — explicit tension between requirements
    // -------------------------------------------------------------------------

    conflicts_with_decl: $ => seq(
      'conflicts-with',
      $.requirement_id,
      repeat(seq(',', $.requirement_id)),
    ),

    // -------------------------------------------------------------------------
    // Decomposed-into — derived context-level obligations
    // -------------------------------------------------------------------------

    decomposed_into_block: $ => seq(
      'decomposed-into',
      '{',
      repeat1($.requirement_id),
      '}',
    ),

    // -------------------------------------------------------------------------
    // Satisfied-by — traceability links to domain model elements
    // -------------------------------------------------------------------------

    satisfied_by_block: $ => seq(
      'satisfied-by', '{',
      repeat(choice(
        $.implemented_by_clause,
        $.structured_by_clause,
        $.enforced_by_clause,
        $.detected_by_clause,
        $.quality_constrained_by_clause,
        $.satisfied_by_infrastructure,
      )),
      '}',
    ),

    implemented_by_clause: $ => seq('implemented-by', $.domain_ref),
    structured_by_clause: $ => seq('structured-by', $.domain_ref),
    enforced_by_clause: $ => seq('enforced-by', $.domain_ref),
    detected_by_clause: $ => seq('detected-by', $.domain_ref),
    quality_constrained_by_clause: $ => seq('quality-constrained-by', $.domain_ref),
    satisfied_by_infrastructure: $ => 'satisfied-by-infrastructure',

    domain_ref: $ => seq(
      choice($.type_name, $.identifier),
      optional(choice(
        seq('.', $.string_literal),   // TypeName."operation label"
        seq('.', $.identifier),       // TypeName.fieldName
      )),
    ),

    // -------------------------------------------------------------------------
    // Literals and identifiers
    // -------------------------------------------------------------------------

    string_literal: $ => token(seq(
      '"',
      /([^"\\]|\\.)*/,
      '"',
    )),

    type_name: $ => /[A-Z][A-Za-z0-9]*/,

    identifier: $ => /[a-z][a-zA-Z0-9_]*/,

    // -------------------------------------------------------------------------
    // Comments
    // -------------------------------------------------------------------------

    comment: $ => token(choice(
      seq('#', /.*/),
      seq('//', /.*/),
    )),
  },
});
