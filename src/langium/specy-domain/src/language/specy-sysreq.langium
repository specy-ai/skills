// =============================================================================
// Specy System Requirements Grammar (.sysreq)
//
// Mirrors src/tree-sitters/tree-sitter-specy-sysreq/grammar.js (the grammar the
// examples are smoke-tested against) and src/grammars/sysreq.ebnf, both derived
// from src/metamodels/SYSTEM-REQ-METAMODEL.md. Keep them in sync.
//
// Imports the domain grammar for the shared terminals (STRING, TYPE_NAME, ID,
// REQUIREMENT_ID, the hidden `//` and `#` comments). None of the domain's
// parser rules is called, so its keywords stay ordinary words in a .sysreq
// file. Rule names carry the `Req` prefix: the five grammars generate one AST
// module.
// =============================================================================

grammar SpecySysreq

import "./specy-domain";

// -----------------------------------------------------------------------------
// Top-level: requirement sets, each scoped to a bounded context or organization
// -----------------------------------------------------------------------------

entry ReqFile:
    (sets+=ReqSetDef)*;

ReqSetDef:
    'requirements' name=STRING 'scoped-to' scope=TypeName
    '{'
        (members+=ReqSetMember)*
    '}';

// prd-source may be repeated; modules and loose requirements mix in any order.
ReqSetMember:
    ReqPrdSourceDecl | ReqModuleBlock | ReqRequirementDef;

ReqPrdSourceDecl:
    'prd-source' path=STRING;

// Module — an optional grouping of requirements within a set.
ReqModuleBlock:
    'module' name=STRING '{' (requirements+=ReqRequirementDef)* '}';

// -----------------------------------------------------------------------------
// Requirement — a named EARS statement.
//
//   REQ-ID "name" : pattern
//     [:: "rationale" | source "…" | traceability clauses]   (any order)
//     "EARS statement"
//     priority <level>
//     [traceability clauses]                                  (any order)
//
// The clauses before the statement and those after the priority land in the
// same list: the normalizer places them, whichever side they were written on.
// -----------------------------------------------------------------------------

ReqRequirementDef:
    id=REQUIREMENT_ID name=STRING ':' pattern=ReqEarsPattern
    (clauses+=ReqClause)*
    statement=STRING
    'priority' priority=ReqMoscowPriority
    (clauses+=ReqTraceClause)*;

ReqClause:
    ReqRationale | ReqSourceDecl | ReqTraceClause;

ReqTraceClause:
    ReqDependsOn | ReqConflictsWith | ReqDecomposedInto | ReqSatisfiedBy;

ReqEarsPattern returns string:
    'ubiquitous' | 'state-driven' | 'event-driven' | 'unwanted' | 'optional' | 'complex';

ReqMoscowPriority returns string:
    'must' | 'should' | 'could' | 'wont';

// Rationale — the `::` operator of every Specy language. Does not change semantics.
ReqRationale:
    '::' text=STRING;

// Source — provenance reference to a PRD element (an id when it has one).
ReqSourceDecl:
    'source' reference=STRING;

ReqDependsOn:
    'depends-on' ids+=REQUIREMENT_ID (',' ids+=REQUIREMENT_ID)*;

ReqConflictsWith:
    'conflicts-with' ids+=REQUIREMENT_ID (',' ids+=REQUIREMENT_ID)*;

ReqDecomposedInto:
    'decomposed-into' '{' (ids+=REQUIREMENT_ID)+ '}';

// -----------------------------------------------------------------------------
// Satisfied-by — traceability links to domain elements, by role.
// `satisfied-by-infrastructure` names no element: the obligation is met below
// the domain layer.
// -----------------------------------------------------------------------------

ReqSatisfiedBy:
    'satisfied-by' '{' (links+=ReqSatisfactionLink)* '}';

ReqSatisfactionLink:
    {infer ReqSatisfactionLink} role=ReqLinkRole target=ReqDomainRef
    | {infer ReqSatisfactionLink} role='satisfied-by-infrastructure';

ReqLinkRole returns string:
    'implemented-by' | 'structured-by' | 'enforced-by' | 'detected-by' | 'quality-constrained-by';

// TypeName | identifier, optionally `.fieldName` or `."operation label"`.
ReqDomainRef:
    head=ReqRefName ('.' (member=ReqRefName | label=STRING))?;

ReqRefName returns string:
    TYPE_NAME | ID | ReqKeywordAsIdent;

// The keywords of this grammar that may also name a domain element.
ReqKeywordAsIdent returns string:
    'module' | 'source' | 'priority' | 'requirements'
    | 'must' | 'should' | 'could' | 'wont'
    | 'ubiquitous' | 'unwanted' | 'optional' | 'complex';
