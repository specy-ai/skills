; =============================================================================
; Highlights — Specy System Requirements (.req)
; =============================================================================

; Keywords
[
  "requirements"
  "scoped-to"
  "prd-source"
  "priority"
  "source"
  "depends-on"
  "conflicts-with"
  "module"
  "decomposed-into"
  "satisfied-by"
  "implemented-by"
  "structured-by"
  "enforced-by"
  "detected-by"
  "quality-constrained-by"
] @keyword

(satisfied_by_infrastructure) @keyword

; Operators
"::" @operator
":" @operator

; EARS patterns
(ears_pattern) @constant

; MoSCoW priority levels
(moscow_priority) @constant

; Requirement IDs
(requirement_id) @label

; String literals
(string_literal) @string

; Requirement name (the string after a requirement_id)
(requirement_def
  name: (string_literal) @string.special)

; Requirement set name
(requirement_set_def
  name: (string_literal) @string.special)

; Module name
(module_block
  name: (string_literal) @string.special)

; PascalCase type names (bounded context)
(type_name) @type

; Domain references — type in domain_ref
(domain_ref (type_name) @type)

; Domain references — operation labels (quoted strings after dot)
(domain_ref "." (string_literal) @string.special)

; Comments
(comment) @comment

; Punctuation
["{" "}"] @punctuation.bracket
"," @punctuation.delimiter
