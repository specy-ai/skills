// =============================================================================
// Specy Product Requirements Grammar (.prd)
//
// Mirrors src/grammars/prd.ebnf and src/tree-sitters/tree-sitter-specy-prd —
// the normative grammars derived from src/metamodels/PRODUCT-REQ-METAMODEL.md.
// Keep them in sync. Where the two differ, this grammar follows the tree-sitter
// one, which is smoke-tested on examples/: the `step` keyword is optional and a
// step is named by a number or a string; a step's and a release's clauses come
// in any order; a goal carries any number of metrics; features, stories and
// acceptance criteria carry their stable ids.
//
// Imports the domain grammar for the shared terminals (STRING, NUMBER, the
// hidden comments). None of the domain's parser rules is called, so its keywords
// stay ordinary words in a .prd file. Rule names carry the `Prd` prefix: the
// five grammars generate one AST module.
// =============================================================================

grammar SpecyPrd

import "./specy-domain";

// -----------------------------------------------------------------------------
// Top-level: products. One per file in practice; the grammar allows several.
// -----------------------------------------------------------------------------

entry PrdFile:
    (products+=PrdProductDef)*;

PrdProductDef:
    'product' name=STRING '{'
        (members+=PrdMember)*
    '}';

// Members come in any order; the normalizer groups them by kind.
PrdMember:
    PrdVisionDecl | PrdScopeBlock | PrdNonGoalsBlock | PrdProblemBlock
    | PrdEvidenceDef | PrdPersonaDef | PrdJobDef | PrdGoalDef | PrdHypothesisDef
    | PrdFeatureDef | PrdAssumptionDef | PrdRiskDef | PrdConstraintDef
    | PrdOpenQuestionDef | PrdReleaseDef | PrdJourneyDef;

// -----------------------------------------------------------------------------
// Vision, scope, non-goals, problem (SCQ)
// -----------------------------------------------------------------------------

PrdVisionDecl:
    'vision' text=STRING;

PrdScopeBlock:
    'scope' '{' (items+=STRING)+ '}';

// Shared by the product (strategic exclusions) and a feature (its own).
PrdNonGoalsBlock:
    'non-goals' '{' (items+=STRING)+ '}';

PrdProblemBlock:
    'problem' '{'
        'situation' situation=STRING
        'complication' complication=STRING
        'question' question=STRING
    '}';

// -----------------------------------------------------------------------------
// Supporting evidence
// -----------------------------------------------------------------------------

PrdEvidenceDef:
    'evidence' name=STRING '{'
        'type' type=PrdEvidenceType
        'summary' summary=STRING
        'source-reference' sourceReference=STRING
        'date' date=PRD_DATE
        'confidence' confidence=PrdConfidence
        'supports' supports=STRING
    '}';

PrdEvidenceType returns string:
    'user-research' | 'analytics' | 'market-research' | 'customer-feedback' | 'domain-expertise';

PrdConfidence returns string:
    'strong' | 'moderate' | 'weak';

// -----------------------------------------------------------------------------
// Persona
// -----------------------------------------------------------------------------

PrdPersonaDef:
    'persona' name=STRING '{'
        'role' role=STRING
        'goals' '{' (goals+=STRING)+ '}'
        'frustrations' '{' (frustrations+=STRING)+ '}'
        'context' context=STRING
        'weight' weight=PrdPersonaWeight
    '}';

PrdPersonaWeight returns string:
    'primary' | 'secondary' | 'excluded';

// -----------------------------------------------------------------------------
// Job — a situation-triggered task a persona is trying to accomplish
// -----------------------------------------------------------------------------

PrdJobDef:
    'job' name=STRING '{'
        'persona' persona=STRING
        'statement' statement=STRING
        'type' type=PrdJobType
        'importance' importance=PrdJobImportance
        'satisfaction' satisfaction=PrdJobSatisfaction
        ('related-to' relatedTo+=STRING (',' relatedTo+=STRING)*)?
        outcomes=PrdDesiredOutcomesBlock?
    '}';

PrdJobType returns string:
    'functional' | 'emotional' | 'social';

PrdJobImportance returns string:
    'critical' | 'important' | 'nice-to-have';

PrdJobSatisfaction returns string:
    'unserved' | 'underserved' | 'adequately-served' | 'overserved';

PrdDesiredOutcomesBlock:
    'desired-outcomes' '{' (outcomes+=PrdDesiredOutcome)+ '}';

PrdDesiredOutcome:
    statement=STRING '{'
        'importance' importance=PrdLevel
        'current-satisfaction' currentSatisfaction=PrdLevel
    '}';

PrdLevel returns string:
    'high' | 'medium' | 'low';

// -----------------------------------------------------------------------------
// Goal and its metrics
// -----------------------------------------------------------------------------

PrdGoalDef:
    'goal' name=STRING '{'
        'statement' statement=STRING
        'horizon' horizon=PrdHorizon
        'owner' owner=STRING
        (metrics+=PrdMetricBlock)*
    '}';

PrdHorizon returns string:
    'short-term' | 'mid-term' | 'long-term';

PrdMetricBlock:
    'metric' '{'
        'indicator' indicator=STRING
        'target' target=STRING
        ('baseline' baseline=STRING)?
        'measurement' measurement=STRING
    '}';

// -----------------------------------------------------------------------------
// Hypothesis — a testable causal claim linking a feature to a goal
// -----------------------------------------------------------------------------

PrdHypothesisDef:
    'hypothesis' name=STRING '{'
        'intervention' intervention=STRING
        'expected-outcome' expectedOutcome=STRING
        'mechanism' mechanism=STRING
        'validation-method' validationMethod=STRING
        'status' status=PrdHypothesisStatus
        'proposes' proposes=STRING
        'predicts' predicts=STRING
        ('supported-by' supportedBy+=STRING (',' supportedBy+=STRING)*)?
    '}';

PrdHypothesisStatus returns string:
    'proposed' | 'testing' | 'validated' | 'invalidated' | 'inconclusive';

// -----------------------------------------------------------------------------
// Feature, its stories and acceptance criteria. The leading ids are the stable
// identifiers the system requirements reference (`source "AC-004-02"`).
// -----------------------------------------------------------------------------

PrdFeatureDef:
    'feature' id=FEAT_ID? name=STRING '{'
        'summary' summary=STRING
        'persona' persona=STRING
        'value-proposition' valueProposition=STRING
        'priority' priority=PrdPriority
        'status' status=PrdFeatureStatus
        ('addresses' addresses+=STRING (',' addresses+=STRING)*)?
        ('advances' advances+=STRING (',' advances+=STRING)*)?
        ('tested-by' testedBy=STRING)?
        designReferences=PrdDesignReferencesBlock?
        nonGoals=PrdNonGoalsBlock?
        stories=PrdStoriesBlock?
    '}';

PrdPriority returns string:
    'must' | 'should' | 'could' | 'wont';

PrdFeatureStatus returns string:
    'proposed' | 'accepted' | 'in-progress' | 'delivered' | 'deferred' | 'rejected';

PrdDesignReferencesBlock:
    'design-references' '{' (references+=PrdDesignReference)+ '}';

PrdDesignReference:
    name=STRING '->' url=STRING;

PrdStoriesBlock:
    'stories' '{' (stories+=PrdStoryDef)+ '}';

PrdStoryDef:
    id=US_ID? title=STRING '{'
        'acceptance-criteria' '{' (criteria+=PrdAcceptanceCriterion)+ '}'
    '}';

PrdAcceptanceCriterion:
    id=AC_ID? text=STRING;

// -----------------------------------------------------------------------------
// Assumption, risk, constraint, open question
// -----------------------------------------------------------------------------

PrdAssumptionDef:
    'assumption' name=STRING '{'
        'statement' statement=STRING
        'impact-if-wrong' impactIfWrong=STRING
        'validation-plan' validationPlan=STRING
        'status' status=PrdAssumptionStatus
        ('underpins' underpins+=STRING (',' underpins+=STRING)*)?
    '}';

PrdAssumptionStatus returns string:
    'unvalidated' | 'validated' | 'invalidated';

PrdRiskDef:
    'risk' name=STRING '{'
        'statement' statement=STRING
        'likelihood' likelihood=PrdLevel
        'impact' impact=PrdImpact
        'mitigation' mitigation=PrdMitigation
        'owner' owner=STRING
        ('threatens' threatens+=STRING (',' threatens+=STRING)*)?
    '}';

PrdImpact returns string:
    'low' | 'medium' | 'high' | 'critical';

PrdMitigation returns string:
    'accept' | 'mitigate' | 'avoid' | 'transfer';

PrdConstraintDef:
    'constraint' name=STRING '{'
        'statement' statement=STRING
        'source' source=PrdConstraintSource
        ('constrains' constrains+=STRING (',' constrains+=STRING)*)?
    '}';

PrdConstraintSource returns string:
    'regulatory' | 'contractual' | 'technical' | 'organizational' | 'market';

PrdOpenQuestionDef:
    'open-question' name=STRING '{'
        'question' question=STRING
        'context' context=STRING
        'owner' owner=STRING
        'deadline' deadline=PRD_DATE
        'status' status=PrdQuestionStatus
        ('blocks' blocks+=STRING (',' blocks+=STRING)*)?
        ('resolution' resolution=STRING)?
    '}';

PrdQuestionStatus returns string:
    'open' | 'investigating' | 'resolved' | 'deferred';

// -----------------------------------------------------------------------------
// Release — any subset of clauses, in any order (tree-sitter), so the members
// are a list the normalizer sorts out.
// -----------------------------------------------------------------------------

PrdReleaseDef:
    'release' name=STRING '{'
        (members+=PrdReleaseMember)*
    '}';

PrdReleaseMember:
    PrdTargetDateDecl | PrdThemeDecl | PrdReleaseStatusDecl | PrdDependsOnDecl
    | PrdIncludesBlock | PrdEntryCriteriaBlock | PrdExitCriteriaBlock;

PrdTargetDateDecl:
    'target-date' value=STRING;

PrdThemeDecl:
    'theme' value=STRING;

PrdReleaseStatusDecl:
    'status' value=PrdReleaseStatus;

PrdReleaseStatus returns string:
    'planned' | 'in-progress' | 'shipped' | 'cancelled';

PrdDependsOnDecl:
    'depends-on' items+=STRING (',' items+=STRING)*;

PrdIncludesBlock:
    'includes' '{' (items+=STRING)+ '}';

PrdEntryCriteriaBlock:
    'entry-criteria' '{' (items+=STRING)+ '}';

PrdExitCriteriaBlock:
    'exit-criteria' '{' (items+=STRING)+ '}';

// -----------------------------------------------------------------------------
// Journey and its steps. A step is `step 1 { … }`, `1 { … }` or `"what the
// persona does" { … }` (the name then doubles as the action); its clauses come
// in any order.
// -----------------------------------------------------------------------------

PrdJourneyDef:
    'journey' name=STRING 'for' persona=STRING '{'
        'trigger' trigger=STRING
        'outcome' outcome=STRING
        designReferences=PrdDesignReferencesBlock?
        steps=PrdStepsBlock?
    '}';

PrdStepsBlock:
    'steps' '{' (steps+=PrdStepDef)+ '}';

PrdStepDef:
    'step'? (number=NUMBER | name=STRING) '{'
        (members+=PrdStepMember)*
    '}';

PrdStepMember:
    PrdStepActionDecl | PrdStepSystemResponseDecl | PrdStepChannelDecl
    | PrdStepToneDecl | PrdStepOrderDecl;

PrdStepActionDecl:
    'action' value=STRING;

PrdStepSystemResponseDecl:
    'system-response' value=STRING;

PrdStepChannelDecl:
    'channel' value=PrdChannel;

PrdChannel returns string:
    'app' | 'web' | 'sms' | 'email' | 'physical' | 'backoffice' | 'external';

PrdStepToneDecl:
    'emotional-tone' value=PrdTone;

PrdTone returns string:
    'confident' | 'anxious' | 'frustrated' | 'delighted' | 'neutral';

PrdStepOrderDecl:
    'order' value=NUMBER;

// -----------------------------------------------------------------------------
// Terminals of this grammar. Declared here so they are tried before the
// domain's NUMBER and TYPE_NAME (an id or a date would otherwise lex as one).
// -----------------------------------------------------------------------------

terminal FEAT_ID: /FEAT-\d{3}/;
terminal US_ID: /US-\d{3}/;
terminal AC_ID: /AC-\d{3}-\d{2}/;
terminal PRD_DATE: /\d{4}-\d{2}-\d{2}/;

// The tree-sitter grammar also skips block comments.
hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
