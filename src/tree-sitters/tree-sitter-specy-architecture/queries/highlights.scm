; =============================================================================
; Specy Software Architecture (.arch) — Tree-sitter highlights
; =============================================================================

; ---------------------------------------------------------------------------
; Comments
; ---------------------------------------------------------------------------

(comment) @comment

; ---------------------------------------------------------------------------
; Structure-defining keywords
; ---------------------------------------------------------------------------

"architecture" @keyword.type
"system" @keyword.type
"person" @keyword.type
"externalSystem" @keyword.type
"boundedContext" @keyword.type
"container" @keyword.type
"component" @keyword.type
"interface" @keyword.type
"struct" @keyword.type
"enum" @keyword.type
"union" @keyword.type
"exception" @keyword.type
"typedef" @keyword.type
"channel" @keyword.type
"environment" @keyword.type

; ---------------------------------------------------------------------------
; Structural / clause keywords
; ---------------------------------------------------------------------------

"technology" @keyword
"provides" @keyword
"requires" @keyword
"consumes" @keyword
"publishes" @keyword
"subscribes" @keyword
"carries" @keyword
"connect" @keyword
"deploy" @keyword
"replicas" @keyword
"meta" @keyword
"import" @keyword

; ---------------------------------------------------------------------------
; Operator-like keywords
; ---------------------------------------------------------------------------

"returns" @keyword.operator
"throws" @keyword.operator
"over" @keyword.operator
"on" @keyword.operator
"to" @keyword.operator
"from" @keyword.operator
"satisfies" @keyword.operator
"realizes" @keyword.operator

(publishes_clause "to" @keyword.operator)
(operation_style) @keyword.operator

; ---------------------------------------------------------------------------
; Import / provenance keywords
; ---------------------------------------------------------------------------

(domain_source_decl "domain-source" @keyword.import)
(requirements_source_decl "requirements-source" @keyword.import)
(import_decl "domain" @keyword.import)

; ---------------------------------------------------------------------------
; realizes-ref selectors
; ---------------------------------------------------------------------------

(realizes_ref "module" @keyword)
(realizes_ref "context" @keyword)
(realizes_ref "interface" @keyword)
(realizes_ref "event" @keyword)
(realizes_ref "value" @keyword)
(realizes_ref "type" @keyword)

(import_kind "value" @keyword)
(import_kind "type" @keyword)
(import_kind "event" @keyword)

; ---------------------------------------------------------------------------
; Type names in definition positions
; ---------------------------------------------------------------------------

(architecture_def name: (type_name) @type.definition)
(system_def name: (type_name) @type.definition)
(person_def name: (type_name) @type.definition)
(external_system_def name: (type_name) @type.definition)
(bounded_context_decl name: (type_name) @type.definition)
(container_def name: (type_name) @type.definition)
(component_def name: (type_name) @type.definition)
(interface_def name: (type_name) @type.definition)
(struct_def name: (type_name) @type.definition)
(exception_def name: (type_name) @type.definition)
(union_def name: (type_name) @type.definition)
(enum_def name: (type_name) @type.definition)
(typedef_def name: (type_name) @type.definition)
(import_decl name: (type_name) @type.definition)

; ---------------------------------------------------------------------------
; Type references
; ---------------------------------------------------------------------------

(field_type (type_name) @type)
(type_name) @type

; ---------------------------------------------------------------------------
; Built-in / primitive types
; ---------------------------------------------------------------------------

(primitive_type) @type.builtin
(return_type "void" @type.builtin)

(collection_type "list" @type.builtin)
(collection_type "set" @type.builtin)
(collection_type "map" @type.builtin)

; ---------------------------------------------------------------------------
; Channels / environments (lowercase identifiers in name position)
; ---------------------------------------------------------------------------

(channel_def name: (identifier) @namespace)
(environment_def name: (identifier) @namespace)
(publishes_clause channel: (identifier) @namespace)
(subscribes_clause channel: (identifier) @namespace)

; ---------------------------------------------------------------------------
; Operation names + arguments
; ---------------------------------------------------------------------------

(operation_def name: (identifier) @function)
(arg_decl name: (identifier) @variable.parameter)
(field_def name: (identifier) @variable.member)
(union_member name: (identifier) @variable.member)
(enum_member name: (identifier) @constant)
(metadata_entry key: (identifier) @variable.member)

; ---------------------------------------------------------------------------
; Requirednesss / styles as attributes / constants
; ---------------------------------------------------------------------------

(requiredness) @attribute
(connector_style) @constant

; ---------------------------------------------------------------------------
; Requirement IDs
; ---------------------------------------------------------------------------

(requirement_id) @label

; ---------------------------------------------------------------------------
; Ordinals / numbers
; ---------------------------------------------------------------------------

(ordinal) @number
(integer) @number
(number) @number

; ---------------------------------------------------------------------------
; Strings & booleans
; ---------------------------------------------------------------------------

(string_literal) @string
(description (string_literal) @string.special)
(boolean) @boolean
(null_literal) @constant.builtin

; ---------------------------------------------------------------------------
; Operators & punctuation
; ---------------------------------------------------------------------------

(description "::" @operator)
"->" @operator
"=" @operator

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
"." @punctuation.delimiter
