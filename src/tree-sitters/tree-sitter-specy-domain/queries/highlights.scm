; =============================================================================
; Specy Domain Model — Tree-sitter highlights
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
"event" @keyword.type
"aggregate" @keyword.type
"interface" @keyword.type

(domain_service_def "domain" @keyword.type)
(domain_service_def "service" @keyword.type)
(application_service_def "application" @keyword.type)
(application_service_def "service" @keyword.type)
(infrastructure_service_def "infrastructure" @keyword.type)
(infrastructure_service_def "service" @keyword.type)
(service_def "service" @keyword.type)
(repository_def "repository" @keyword.type)
(repository_def "for" @keyword.type)
(external_event_def "external" @keyword.type)
(external_event_def "event" @keyword.type)
(error_event_def "error" @keyword.type)
(error_event_def "event" @keyword.type)
(temporal_event_def "temporal" @keyword.type)
(temporal_event_def "event" @keyword.type)
(temporal_event_def "temporal-event" @keyword.type)

(reaction_def "reaction" @keyword.type)
(invariant_def "invariant" @keyword.type)
(agreement_def "agreement" @keyword.type)

; ---------------------------------------------------------------------------
; Structural keywords
; ---------------------------------------------------------------------------

"fields" @keyword
"identity" @keyword
"identifier" @keyword
"references" @keyword
"operations" @keyword
"states" @keyword
"invariants" @keyword
"map" @keyword
"depends" @keyword
"exposes" @keyword
"root" @keyword
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
"offset" @keyword
"reference" @keyword
"relative-to" @keyword
"instant" @keyword
"schedule" @keyword
"recurring" @keyword
"per-market" @keyword
"compensation" @keyword

(state_def "state" @keyword)
(state_def "final" @keyword)

; ---------------------------------------------------------------------------
; Operation / behavior keywords
; ---------------------------------------------------------------------------

(command_triggered_op "on" @keyword.operator)
(event_triggered_op "when" @keyword.operator)
(event_triggered_op "then" @keyword.operator)
(transition_def "on" @keyword.operator)
(transition_def "when" @keyword.operator)
(transition_def "then" @keyword.operator)
(escalation_step "when" @keyword.operator)

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
"trigger" @keyword.operator
"guard" @keyword.operator
"effect" @keyword.operator
"must" @keyword.operator
"enforcement" @keyword.operator
"triggers" @keyword.operator
"satisfies" @keyword.operator

; ---------------------------------------------------------------------------
; Control-flow / expression keywords
; ---------------------------------------------------------------------------

(if_expr "if" @keyword.control)
(every_expr "every" @keyword.control)
(every_expr "in" @keyword.control)
(in_expr "in" @keyword.control)
(not_in_expr "not" @keyword.control)
(not_in_expr "in" @keyword.control)
(is_defined_expr "is" @keyword.control)
(is_defined_expr "defined" @keyword.control)
(is_not_defined_expr "is" @keyword.control)
(is_not_defined_expr "not" @keyword.control)
(is_not_defined_expr "defined" @keyword.control)

(or_expr "or" @keyword.control)
(and_expr "and" @keyword.control)
(not_expr "not" @keyword.control)

; ---------------------------------------------------------------------------
; Import keywords
; ---------------------------------------------------------------------------

(requirements_source_decl "requirements-source" @keyword.import)
(uses_decl "uses" @keyword.import)

; ---------------------------------------------------------------------------
; Type names in definition positions
; ---------------------------------------------------------------------------

(organization_def name: (type_name) @type.definition)
(context_def name: (type_name) @type.definition)
(module_def name: (type_name) @type.definition)
(enum_def name: (type_name) @type.definition)
(value_def name: (type_name) @type.definition)
(entity_def name: (type_name) @type.definition)
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
(service_def name: (type_name) @type.definition)
(repository_def name: (type_name) @type.definition)
(repository_def entity: (type_name) @type)
(reaction_def name: (type_name) @type.definition)
(invariant_def name: (type_name) @type.definition)
(agreement_def name: (type_name) @type.definition)
(interface_def name: (type_name) @type.definition)
(state_machine_def name: (type_name) @type.definition)
(reconciliation_def name: (type_name) @type.definition)

; ---------------------------------------------------------------------------
; Type references (PascalCase identifiers in type positions)
; ---------------------------------------------------------------------------

(field_type (type_name) @type)

; type_name in other positions (command targets, event references, etc.)
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

; ---------------------------------------------------------------------------
; Parameter names
; ---------------------------------------------------------------------------

(param_decl name: (identifier) @variable.parameter)

; ---------------------------------------------------------------------------
; Function / operation names
; ---------------------------------------------------------------------------

(internal_op name: (identifier) @function)
(value_op_def name: (identifier) @function)
(named_operation_def name: (string_literal) @function)
(scoped_invariant_def name: (identifier) @function)
(precondition_clause name: (identifier) @function)
(postcondition_clause name: (identifier) @function)
(reaction_call_clause name: (identifier) @function)
(state_invariant_def name: (identifier) @function)
(escalation_step name: (identifier) @function)

; ---------------------------------------------------------------------------
; Built-in functions
; ---------------------------------------------------------------------------

(function_name) @function.builtin

; ---------------------------------------------------------------------------
; Service call targets (dot_path in call position)
; ---------------------------------------------------------------------------

(service_call_clause (dot_path) @function.call)
(service_call_expr (dot_path) @function.call)

; ---------------------------------------------------------------------------
; Constraints / attributes
; ---------------------------------------------------------------------------

(constraint "required" @attribute)
(constraint "optional" @attribute)
(constraint "unique" @attribute)
(constraint "immutable" @attribute)
(constraint "ordered" @attribute)
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
; Constants: enum values, context map patterns, enforcement strategies, etc.
; ---------------------------------------------------------------------------

(enum_value) @constant

(upstream_pattern) @constant
(downstream_pattern) @constant
(symmetric_pattern) @constant

(enforcement_strategy "rejection" @constant)
(enforcement_strategy "alert" @constant)
(enforcement_strategy "compensation" @constant)

(detection_strategy) @constant
(coordination_style) @constant

(escalation_action "retry" @constant)
(escalation_action "compensate" @constant)
(escalation_action "alert" @constant)
(escalation_action "suspend" @constant)
(escalation_action "manual" @constant)

(transition_source "[*]" @constant)

; ---------------------------------------------------------------------------
; Strings
; ---------------------------------------------------------------------------

(string_literal) @string
(description (string_literal) @string.special)
(command_triggered_op label: (string_literal) @string.special)
(event_triggered_op label: (string_literal) @string.special)

; ---------------------------------------------------------------------------
; Numbers and cardinality
; ---------------------------------------------------------------------------

(number) @number
(cardinality) @number

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
