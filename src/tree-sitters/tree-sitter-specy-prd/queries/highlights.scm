; =============================================================================
; Highlights — tree-sitter-specy-prd
; =============================================================================

; ---------------------------------------------------------------------------
; Concept keywords — @keyword.type
; ---------------------------------------------------------------------------

[
  "product"
  "evidence"
  "persona"
  "job"
  "goal"
  "hypothesis"
  "feature"
  "assumption"
  "risk"
  "constraint"
  "open-question"
  "release"
  "journey"
  "step"
  "problem"
  "scope"
  "non-goals"
  "metric"
  "stories"
  "steps"
  "desired-outcomes"
  "design-references"
  "includes"
  "entry-criteria"
  "exit-criteria"
] @keyword.type

; ---------------------------------------------------------------------------
; Field labels — @keyword
; ---------------------------------------------------------------------------

[
  "vision"
  "situation"
  "complication"
  "question"
  "type"
  "summary"
  "source-reference"
  "date"
  "confidence"
  "supports"
  "role"
  "goals"
  "frustrations"
  "context"
  "weight"
  "statement"
  "importance"
  "satisfaction"
  "related-to"
  "current-satisfaction"
  "horizon"
  "owner"
  "indicator"
  "target"
  "baseline"
  "measurement"
  "intervention"
  "expected-outcome"
  "mechanism"
  "validation-method"
  "status"
  "proposes"
  "predicts"
  "supported-by"
  "value-proposition"
  "priority"
  "addresses"
  "advances"
  "tested-by"
  "acceptance-criteria"
  "for"
  "trigger"
  "outcome"
  "action"
  "system-response"
  "channel"
  "emotional-tone"
  "order"
  "impact-if-wrong"
  "validation-plan"
  "underpins"
  "likelihood"
  "impact"
  "mitigation"
  "threatens"
  "source"
  "constrains"
  "deadline"
  "blocks"
  "resolution"
  "target-date"
  "theme"
  "depends-on"
] @keyword

; ---------------------------------------------------------------------------
; Names — @string.special  (the string right after a concept keyword)
; ---------------------------------------------------------------------------

(product_def name: (string_literal) @string.special)
(evidence_def name: (string_literal) @string.special)
(persona_def name: (string_literal) @string.special)
(job_def name: (string_literal) @string.special)
(goal_def name: (string_literal) @string.special)
(hypothesis_def name: (string_literal) @string.special)
(feature_def name: (string_literal) @string.special)
(assumption_def name: (string_literal) @string.special)
(risk_def name: (string_literal) @string.special)
(constraint_def name: (string_literal) @string.special)
(open_question_def name: (string_literal) @string.special)
(release_def name: (string_literal) @string.special)
(journey_def name: (string_literal) @string.special)
(step_def name: (string_literal) @string.special)
(journey_def persona: (string_literal) @string.special)

; ---------------------------------------------------------------------------
; Enum values — @constant
; ---------------------------------------------------------------------------

(evidence_type) @constant
(confidence_level) @constant
(persona_weight) @constant
(job_type) @constant
(job_importance) @constant
(job_satisfaction) @constant
(outcome_level) @constant
(goal_horizon) @constant
(hypothesis_status) @constant
(moscow_priority) @constant
(feature_status) @constant
(assumption_status) @constant
(likelihood_level) @constant
(impact_level) @constant
(mitigation_strategy) @constant
(constraint_source) @constant
(question_status) @constant
(release_status) @constant
(channel_type) @constant
(emotional_tone) @constant

; ---------------------------------------------------------------------------
; Strings — @string
; ---------------------------------------------------------------------------

(string_literal) @string

; ---------------------------------------------------------------------------
; Dates — @attribute
; ---------------------------------------------------------------------------

(date_literal) @attribute

; ---------------------------------------------------------------------------
; Numbers — @number
; ---------------------------------------------------------------------------

(integer) @number

; ---------------------------------------------------------------------------
; Comments — @comment
; ---------------------------------------------------------------------------

(comment) @comment

; ---------------------------------------------------------------------------
; Punctuation — brackets and delimiters
; ---------------------------------------------------------------------------

"{" @punctuation.bracket
"}" @punctuation.bracket

"," @punctuation.delimiter

; ---------------------------------------------------------------------------
; Operator
; ---------------------------------------------------------------------------

"->" @operator
