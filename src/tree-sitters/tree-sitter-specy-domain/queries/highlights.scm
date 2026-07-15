; =============================================================================
; Specy Domain Model — Tree-sitter highlights
;
; Mirrors src/tree-sitters/tree-sitter-specy-domain/grammar.js. Every node and
; field named here must exist in the grammar — `tree-sitter query` runs against
; every example in build.sh, so a stale name fails the build.
; =============================================================================

; ---------------------------------------------------------------------------
; Comments
; ---------------------------------------------------------------------------

(comment) @comment

; ---------------------------------------------------------------------------
; Type-defining keywords
; ---------------------------------------------------------------------------

"organization" @keyword.type
"context" @keyword.type
"module" @keyword.type
"entity" @keyword.type
"value" @keyword.type
"enum" @keyword.type
"command" @keyword.type
"query" @keyword.type
"event" @keyword.type
"aggregate" @keyword.type
"interface" @keyword.type

; The interface role is the discriminator between a driving and a driven port.
(interface_role) @keyword.type

(read_only_entity_def "read-only" @keyword.type)
(read_only_entity_def "entity" @keyword.type)

(domain_service_def "domain" @keyword.type)
(domain_service_def "service" @keyword.type)
(application_service_def "application" @keyword.type)
(application_service_def "service" @keyword.type)
(infrastructure_service_def "infrastructure" @keyword.type)
(infrastructure_service_def "service" @keyword.type)

(repository_def "repository" @keyword.type)
(repository_def "read-only" @keyword.type)
(repository_def "for" @keyword.type)

(external_event_def "external" @keyword.type)
(external_event_def "event" @keyword.type)
(error_event_def "error" @keyword.type)
(error_event_def "event" @keyword.type)
(temporal_event_def "temporal" @keyword.type)
(temporal_event_def "event" @keyword.type)

(reaction_def "reaction" @keyword.type)
(invariant_def "invariant" @keyword.type)
(agreement_def "agreement" @keyword.type)

; ---------------------------------------------------------------------------
; Structural keywords
; ---------------------------------------------------------------------------

"fields" @keyword
"identity" @keyword
"references" @keyword
"operations" @keyword
"states" @keyword
"invariants" @keyword
"map" @keyword
"depends" @keyword
"exposes" @keyword
"requires" @keyword
"entities" @keyword
"machine" @keyword
"participants" @keyword
"predicate" @keyword
"reconciliation" @keyword
"detection" @keyword
"coordination" @keyword
"escalation" @keyword
"step" @keyword
"action" @keyword
"meta" @keyword
"duplicate" @keyword
"detection" @keyword
"of" @keyword
"calls" @keyword

(state_def "state" @keyword)
(state_def "final" @keyword)

; ---------------------------------------------------------------------------
; Hexagonal wiring — the port/adapter relations
; ---------------------------------------------------------------------------

(describes_clause "describes" @keyword.operator)
(described_by_clause "described-by" @keyword.operator)
(exposed_by_clause "exposed-by" @keyword.operator)

; ---------------------------------------------------------------------------
; Read-only entity (master data) — provenance and sync
; ---------------------------------------------------------------------------

(sourced_from_clause "sourced-from" @keyword.operator)
(synced_via_clause "synced-via" @keyword.operator)
(projected_by_clause "projected-by" @keyword.operator)
(sync_pattern) @constant

; ---------------------------------------------------------------------------
; Temporal anchors — time is never the cause; these are the domain anchors
; ---------------------------------------------------------------------------

(relative_anchor "reference" @keyword)
(relative_anchor "offset" @keyword)
(absolute_anchor "instant" @keyword)
(recurring_anchor "schedule" @keyword)
(guard_block "guard" @keyword.operator)

; ---------------------------------------------------------------------------
; Operation / behavior keywords
; ---------------------------------------------------------------------------

(command_triggered_op "on" @keyword.operator)
(transition_def "on" @keyword.operator)
(invariant_def "on" @keyword.operator)
(non_terminal_step "when" @keyword.operator)
(terminal_step "when" @keyword.operator)

; safe / unsafe / idempotent are first-class operation attributes.
(safety_decl) @keyword.modifier
(idempotence_decl) @keyword.modifier

"creates" @keyword.operator
"sets" @keyword.operator
"emits" @keyword.operator
"resolves" @keyword.operator
"from" @keyword.operator
"foreach" @keyword.operator
"as" @keyword.operator
"returns" @keyword.operator
"precondition" @keyword.operator
"postcondition" @keyword.operator
"rejects" @keyword.operator
"must" @keyword.operator
"enforcement" @keyword.operator
"satisfies" @keyword.operator
"about" @keyword.operator
"caused-by" @keyword.operator
"reads-from" @keyword.operator

; A reaction is the sole event -> command edge.
(triggered_by_clause "triggered-by" @keyword.operator)
(effects_clause "effects" @keyword.operator)

; ---------------------------------------------------------------------------
; Control-flow / expression keywords
; ---------------------------------------------------------------------------

(if_expr "if" @keyword.control)
(every_expr "every" @keyword.control)
(every_expr "in" @keyword.control)
(quantifier_expr "in" @keyword.control)
(quantifier_expr "where" @keyword.control)
(in_expr "in" @keyword.control)
(not_in_expr "not" @keyword.control)
(not_in_expr "in" @keyword.control)
(is_defined_expr "is" @keyword.control)
(is_defined_expr "defined" @keyword.control)
(is_not_defined_expr "is" @keyword.control)
(is_not_defined_expr "not" @keyword.control)
(is_not_defined_expr "defined" @keyword.control)
(is_null_expr "is" @keyword.control)
(is_not_null_expr "is" @keyword.control)
(is_not_null_expr "not" @keyword.control)

(or_expr "or" @keyword.control)
(and_expr "and" @keyword.control)
(not_expr "not" @keyword.control)

; ---------------------------------------------------------------------------
; Import keywords
; ---------------------------------------------------------------------------

(requirements_source_decl "requirements-source" @keyword.import)

; ---------------------------------------------------------------------------
; Type names in definition positions
; ---------------------------------------------------------------------------

(organization_def name: (type_name) @type.definition)
(context_def name: (type_name) @type.definition)
(module_def name: (type_name) @type.definition)
(enum_def name: (type_name) @type.definition)
(value_def name: (type_name) @type.definition)
(entity_def name: (type_name) @type.definition)
(read_only_entity_def name: (type_name) @type.definition)
(aggregate_def name: (type_name) @type.definition)
(command_def name: (type_name) @type.definition)
(query_def name: (type_name) @type.definition)
(event_def name: (type_name) @type.definition)
(external_event_def name: (type_name) @type.definition)
(error_event_def name: (type_name) @type.definition)
(temporal_event_def name: (type_name) @type.definition)
(domain_service_def name: (type_name) @type.definition)
(application_service_def name: (type_name) @type.definition)
(infrastructure_service_def name: (type_name) @type.definition)
(repository_def name: (type_name) @type.definition)
(repository_def entity: (type_name) @type)
(reaction_def name: (type_name) @type.definition)
(invariant_def name: (type_name) @type.definition)
(agreement_def name: (type_name) @type.definition)
(interface_def name: (type_name) @type.definition)
(state_machine_def name: (type_name) @type.definition)
(reconciliation_def name: (type_name) @type.definition)

; ---------------------------------------------------------------------------
; Type references
; ---------------------------------------------------------------------------

(field_type (type_name) @type)
(type_name) @type

; ---------------------------------------------------------------------------
; Built-in / primitive types
; ---------------------------------------------------------------------------

(primitive_type) @type.builtin

(collection_type "list" @type.builtin)
(collection_type "set" @type.builtin)
(collection_type "map" @type.builtin)

; ---------------------------------------------------------------------------
; Module / context names
; ---------------------------------------------------------------------------

(module_def name: (type_name) @module)
(context_def name: (type_name) @module)

; ---------------------------------------------------------------------------
; Field names
; ---------------------------------------------------------------------------

(field_decl name: (identifier) @variable.member)
(identity_decl name: (identifier) @variable.member)
(reference_decl name: (identifier) @variable.member)
(assignment_clause field: (identifier) @variable.member)
(metadata_entry (identifier) @variable.member)

; ---------------------------------------------------------------------------
; Parameter names
; ---------------------------------------------------------------------------

(param_decl name: (identifier) @variable.parameter)

; ---------------------------------------------------------------------------
; Function / operation names
; ---------------------------------------------------------------------------

(internal_op name: (identifier) @function)
(value_op_def name: (identifier) @function)
(safe_op_def name: (identifier) @function)
(operation_signature name: (identifier) @function)
(scoped_invariant_def name: (identifier) @function)
(precondition_clause name: (condition_name) @function)
(postcondition_clause name: (condition_name) @function)
(non_terminal_step name: (identifier) @function)
(terminal_step name: (identifier) @function)

; ---------------------------------------------------------------------------
; Calls. A built-in and a service call are syntactically identical — telling
; them apart needs a symbol table, so both highlight as a call.
; ---------------------------------------------------------------------------

(service_call_clause (dot_path) @function.call)
(call_expr (dot_path) @function.call)

; ---------------------------------------------------------------------------
; Constraints / attributes
; ---------------------------------------------------------------------------

(constraint "required" @attribute)
(constraint "optional" @attribute)
(constraint "unique" @attribute)
(constraint "immutable" @attribute)
(constraint "ordered" @attribute)
(constraint "code" @attribute)
(constraint "default" @attribute)
(constraint "min" @attribute)
(constraint "max" @attribute)
(constraint "range" @attribute)
(constraint "minLength" @attribute)
(constraint "maxLength" @attribute)
(constraint "pattern" @attribute)
(constraint "past" @attribute)
(constraint "future" @attribute)
(constraint "pastOrPresent" @attribute)
(constraint "futureOrPresent" @attribute)

; ---------------------------------------------------------------------------
; Requirement IDs in satisfies
; ---------------------------------------------------------------------------

(requirement_id) @label

; ---------------------------------------------------------------------------
; Constants
; ---------------------------------------------------------------------------

(enum_value name: (identifier) @constant)

(upstream_pattern) @constant
(downstream_pattern) @constant
(symmetric_pattern) @constant

(enforcement_strategy "rejection" @constant)
(enforcement_strategy "alert" @constant)
(enforcement_strategy "compensation" @constant)

(detection_strategy) @constant
(coordination_style) @constant

; An escalation chain must terminate: non-terminal actions can fail, terminal
; ones are end states.
(non_terminal_action "retry" @constant)
(non_terminal_action "compensate" @constant)
(terminal_action "alert" @constant)
(terminal_action "suspend" @constant)
(terminal_action "manual" @constant)

(transition_source "[*]" @constant)

(null_literal) @constant.builtin

; ---------------------------------------------------------------------------
; Strings
; ---------------------------------------------------------------------------

(string_literal) @string
(description (string_literal) @string.special)
(command_triggered_op label: (string_literal) @string.special)

; ---------------------------------------------------------------------------
; Numbers, durations and cardinality
; ---------------------------------------------------------------------------

(number) @number
(cardinality) @number
(duration_literal) @number

; ---------------------------------------------------------------------------
; Booleans
; ---------------------------------------------------------------------------

(boolean) @boolean

; ---------------------------------------------------------------------------
; Operators
; ---------------------------------------------------------------------------

(description "::" @operator)
"-->" @operator

(comp_op) @operator
(add_expr "+" @operator)
(add_expr "-" @operator)
(mul_expr "*" @operator)
(mul_expr "/" @operator)
(coalesce_expr "?:" @operator)

; ---------------------------------------------------------------------------
; Punctuation
; ---------------------------------------------------------------------------

"{" @punctuation.bracket
"}" @punctuation.bracket
"(" @punctuation.bracket
")" @punctuation.bracket
"<" @punctuation.bracket
">" @punctuation.bracket
"[" @punctuation.bracket
"]" @punctuation.bracket

"," @punctuation.delimiter
":" @punctuation.delimiter
