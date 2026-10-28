; =============================================================================
; Specy Synthetic-Data Scenario — Tree-sitter highlights
;
; Mirrors src/tree-sitters/tree-sitter-specy-synth/grammar.js. Every node and
; field named here must exist in the grammar — `tree-sitter query` runs against
; the example in build.sh, so a stale name fails the build.
; =============================================================================

(comment) @comment

; ---------------------------------------------------------------------------
; The scenario and the outcome kinds define things
; ---------------------------------------------------------------------------

"scenario" @keyword.type
"curve" @keyword.type
"total" @keyword.type
"share" @keyword.type
"mix" @keyword.type
"rate" @keyword.type
"rollup" @keyword.type

(scenario_def name: (scenario_name) @type.definition)
(outcome_name) @function

; ---------------------------------------------------------------------------
; Structural keywords
; ---------------------------------------------------------------------------

"domain-source" @keyword
"requirements-source" @keyword
"seed" @keyword
"horizon" @keyword
"as-of" @keyword
"populations" @keyword
"outcomes" @keyword
"givens" @keyword
"vocabulary" @keyword
"distributions" @keyword
"options" @keyword
"locale" @keyword
"since" @keyword
"pack" @keyword
"words" @keyword
"median" @keyword
"sigma" @keyword
"uniform" @function.builtin
"lognormal" @function.builtin
"zipf" @function.builtin
"dwell" @keyword
"satisfies" @keyword
"alpha" @keyword
"decimals" @keyword
"null-rate" @keyword
"default-dwell" @keyword
"reaction-latency" @keyword
"rejections" @keyword
"csv" @keyword
"json" @keyword
"rows" @keyword

"count" @keyword.operator
"per" @keyword.operator
"exactly" @keyword.operator
"clock" @keyword.operator
"by" @keyword.operator
"from" @keyword.operator
"over" @keyword.operator
"given" @keyword.operator
"and" @keyword.operator
"or" @keyword.operator
"not" @keyword.operator

(period) @constant.builtin

; ---------------------------------------------------------------------------
; References into the domain
; ---------------------------------------------------------------------------

(entity_ref (type_name) @type)
(member_ref (member_name) @variable.member)
(state_ref (member_name) @constant)
(share_entry member: (member_ref (member_name) @constant))
(rate_predicate member: (member_ref (member_name) @constant))
(state_name (member_name) @constant)
(row_entry key: (member_name) @property)

; ---------------------------------------------------------------------------
; Literals
; ---------------------------------------------------------------------------

(string_literal) @string
(description (string_literal) @string.special)
(requirement_id) @label
(number) @number
(date) @number
(date_time) @number
(period_literal) @number
(duration) @number
(cardinality) @number
(boolean) @boolean
(null) @constant.builtin

; ---------------------------------------------------------------------------
; Operators & punctuation
; ---------------------------------------------------------------------------

"::" @operator
"-->" @operator
".." @operator
"=" @operator
"!=" @operator
"%" @operator

"{" @punctuation.bracket
"}" @punctuation.bracket
"[" @punctuation.bracket
"]" @punctuation.bracket
"," @punctuation.delimiter
":" @punctuation.delimiter
"." @punctuation.delimiter
