// =============================================================================
// Specy Domain Model Grammar (.domain)
//
// Mirrors src/grammars/domain.ebnf — the normative grammar derived from
// src/metamodels/DOMAIN-METAMODEL.md. Keep the three in sync.
//
// Langium is LL(*), so two rules that the (GLR) tree-sitter grammar enforces
// structurally are enforced here by the validator instead. Both are marked
// "VALIDATOR" below.
// =============================================================================

grammar SpecyDomain

// -----------------------------------------------------------------------------
// Top-level
//
// Outer containers (organization > context > module) may be ELIDED: a file may
// start at a context, a module, or a bare definition.
// -----------------------------------------------------------------------------

entry DomainFile:
    (elements+=TopLevelElement)*;

TopLevelElement:
    OrganizationDef | ContextDef | ModuleDef | Definition;

// -----------------------------------------------------------------------------
// Organization
// -----------------------------------------------------------------------------

OrganizationDef:
    'organization' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        requirementsSource=RequirementsSourceDecl?
        (contexts+=ContextDef)+
    '}';

RequirementsSourceDecl:
    'requirements-source' path=STRING;

// -----------------------------------------------------------------------------
// Bounded Context
// -----------------------------------------------------------------------------

ContextDef:
    'context' name=TypeName
    shortname=Shortname?
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        requirementsSource=RequirementsSourceDecl?
        contextMap=ContextMapBlock?
        (members+=(ModuleDef | Definition))*
    '}';

Shortname:
    '(' value=Ident ')';

// -----------------------------------------------------------------------------
// Context Map
// -----------------------------------------------------------------------------

ContextMapBlock:
    'map' '{' (relations+=ContextRelation)* '}';

ContextRelation:
    UpstreamRelation | DownstreamRelation | SymmetricRelation;

UpstreamRelation:
    'upstream' target=TypeName ':' pattern=UpstreamPattern;

DownstreamRelation:
    'downstream' target=TypeName ':' pattern=DownstreamPattern;

SymmetricRelation:
    'symmetric' target=TypeName ':' pattern=SymmetricPattern;

UpstreamPattern returns string:
    'OHS';

DownstreamPattern returns string:
    'CS' | 'Conformist' | 'ACL';

SymmetricPattern returns string:
    'SharedKernel' | 'PublishedLanguage' | 'Partnership' | 'SeparateWays';

// -----------------------------------------------------------------------------
// Module
//
// The two interface relations are NOT symmetric and are declared apart:
//   exposes    { ApiName }     — the public surface
//   requires   { SpiName }     — the capabilities needed from outside
//   depends on { ModuleName }  — other modules
// -----------------------------------------------------------------------------

ModuleDef:
    'module' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        // When the outer containers are elided, the module IS the top level, so it
        // must be able to carry the requirements-source provenance link.
        requirementsSource=RequirementsSourceDecl?
        exposes=ExposesBlock?
        requires=RequiresBlock?
        dependsOn=DependsBlock?
        (members+=Definition)*
    '}';

ExposesBlock:
    'exposes' '{' (interfaces+=TypeName)+ '}';

RequiresBlock:
    'requires' '{' (interfaces+=TypeName)+ '}';

DependsBlock:
    'depends' 'on' '{' (modules+=TypeName)+ '}';

// -----------------------------------------------------------------------------
// Definitions
// -----------------------------------------------------------------------------

Definition:
    EnumDef | ValueDef
    | EntityDef | ReadOnlyEntityDef | AggregateDef
    | CommandDef | QueryDef
    | EventDef | ExternalEventDef | ErrorEventDef | TemporalEventDef
    | DomainServiceDef | ApplicationServiceDef | InfrastructureServiceDef
    | RepositoryDef | InterfaceDef
    | ReactionDef | InvariantDef | AgreementDef;

// -----------------------------------------------------------------------------
// Interface — a port. Every interface declares its role.
//
//   api interface — DRIVING port. `exposes` SELECTS operations that already exist
//                   on an entity, aggregate, domain service or app service.
//   spi interface — DRIVEN port. `describes` names the infrastructure service or
//                   repository that fulfils the contract it DEFINES.
// -----------------------------------------------------------------------------

InterfaceDef:
    role=InterfaceRole 'interface' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        (members+=InterfaceMember)*
    '}';

InterfaceRole returns string:
    'api' | 'spi';

InterfaceMember:
    ExposesClause | DescribesClause | OperationSignature;

ExposesClause:
    'exposes' path=DotPath;

DescribesClause:
    'describes' provider=TypeName;

// A signature, with an optional body carrying only conditions.
OperationSignature:
    name=Ident '(' params=ParamList? ')' (':' returnType=FieldType)?
    description=Description?
    metadata=MetadataBlock?
    ('{'
        satisfies=SatisfiesDecl?
        (conditions+=ConditionClause)*
    '}')?;

// -----------------------------------------------------------------------------
// Satisfies — always the first element inside the body braces.
// -----------------------------------------------------------------------------

SatisfiesDecl:
    'satisfies' '[' ids+=REQUIREMENT_ID (',' ids+=REQUIREMENT_ID)* ']';

// -----------------------------------------------------------------------------
// Enum (Referential)
//
// `of ValueType` — the enum holds instances of a value type, which must then
// declare a `code` field.
// -----------------------------------------------------------------------------

EnumDef:
    'enum' name=TypeName
    ('of' valueType=TypeName)?
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        (values+=EnumValue)+
    '}';

EnumValue:
    name=Ident ('=' value=LiteralValue)? description=Description? ','?;

// -----------------------------------------------------------------------------
// Value Type
// -----------------------------------------------------------------------------

ValueDef:
    'value' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        fields=FieldsBlock
        operations=ValueOperationsBlock?
        invariants=InvariantsBlock?
    '}';

ValueOperationsBlock:
    'operations' '{' (ops+=ValueOpDef)* '}';

// A value operation returns a new value. Its body may carry the preconditions of
// the "transactional constructor".
ValueOpDef:
    name=Ident '(' params=ParamList? ')' ':' returnType=FieldType
    description=Description?
    metadata=MetadataBlock?
    ('{' body=OperationBody '}')?;

// -----------------------------------------------------------------------------
// Entity
// -----------------------------------------------------------------------------

EntityDef:
    'entity' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        identity=IdentityDecl
        duplicateDetection=DuplicateDetection?
        fields=FieldsBlock
        references=ReferencesBlock?
        operations=OperationsBlock?
        states=StatesBlock?
        invariants=InvariantsBlock?
    '}';

IdentityDecl:
    'identity' name=Ident ':' type=FieldType;

DuplicateDetection:
    'duplicate' 'detection' '{' expr=Expression '}';

// -----------------------------------------------------------------------------
// Read-only Entity (Master Data)
//
// State owned by an upstream context or external system. The operations block
// admits only SAFE clauses — no sets / creates / emits — so "no unsafe operations
// on master data" is enforced by the grammar, not a validator.
// -----------------------------------------------------------------------------

ReadOnlyEntityDef:
    'read-only' 'entity' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        sourcedFrom=SourcedFromClause
        syncedVia=SyncedViaClause?
        projectedBy=ProjectedByClause?
        identity=IdentityDecl
        fields=FieldsBlock
        references=ReferencesBlock?
        operations=SafeOperationsBlock?
        invariants=InvariantsBlock?
    '}';

SourcedFromClause:
    'sourced-from' source=(TypeName | STRING);

SyncedViaClause:
    'synced-via' pattern=SyncPattern;

SyncPattern returns string:
    'synchronous-query' | 'asynchronous-projection';

// The ACL adapter that refreshes the local read-model (asynchronous projection).
ProjectedByClause:
    'projected-by' adapter=TypeName;

SafeOperationsBlock:
    'operations' '{' (ops+=SafeOpDef)* '}';

SafeOpDef:
    name=Ident '(' params=ParamList? ')' (':' returnType=FieldType)?
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        safe?='safe'?
        (clauses+=SafeOperationClause)*
    '}';

SafeOperationClause:
    PreconditionClause | PostconditionClause | ResolvesClause
    | ServiceCallClause | SafeForeachClause | ReturnsClause;

SafeForeachClause:
    'foreach' collection=DotPath 'as' variable=Binder '{'
        (body+=SafeOperationClause)*
    '}';

// -----------------------------------------------------------------------------
// Aggregate
//
// An aggregate IS its root entity: it carries the identity, fields, operations,
// states and invariants directly. There is no `root` clause. `entities { }` lists
// the NON-ROOT children of the cluster.
// -----------------------------------------------------------------------------

AggregateDef:
    'aggregate' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        identity=IdentityDecl
        duplicateDetection=DuplicateDetection?
        fields=FieldsBlock
        entities=AggregateEntitiesDecl
        references=ReferencesBlock?
        operations=OperationsBlock?
        states=StatesBlock?
        invariants=InvariantsBlock?
    '}';

AggregateEntitiesDecl:
    'entities' '{' (entities+=TypeName)+ '}';

// -----------------------------------------------------------------------------
// Fields & References
// -----------------------------------------------------------------------------

FieldsBlock:
    'fields' '{' (fields+=FieldDecl)* '}';

// NOTE (known limitation, carried over): `required` and `optional` are bare
// constraint keywords AND legal field names (KeywordAsIdent). A field named
// exactly `required`/`optional` that follows another field is only distinguishable
// from a trailing constraint by the `:` after it. Langium's ALL(*) strategy
// resolves the constraint repetition greedily; the tree-sitter (GLR) parser
// handles it.
FieldDecl:
    name=FieldName ':' type=FieldType optional?='?'?
    (constraints+=Constraint)*
    description=Description?
    satisfies=SatisfiesDecl?;

ReferencesBlock:
    'references' '{' (refs+=ReferenceDecl)* '}';

ReferenceDecl:
    name=Ident ':' target=TypeName cardinality=CARDINALITY description=Description?;

FieldType:
    PrimitiveType | CollectionType | GenericType | {infer FieldType} typeName=TypeName;

PrimitiveType:
    value=PrimitiveTypeKw;

PrimitiveTypeKw returns string:
    'string' | 'int' | 'integer' | 'long' | 'decimal' | 'boolean'
    | 'date' | 'datetime' | 'time' | 'duration' | 'uuid' | 'void';

CollectionType:
    kind=CollectionKind '<' elementType=FieldType (',' valueType=FieldType)? '>';

CollectionKind returns string:
    'list' | 'set' | 'map';

GenericType:
    typeName=TypeName '<' elementType=FieldType (',' valueType=FieldType)? '>';

// `code` marks the field by which an enum's value-type instances are referenced.
Constraint:
    {infer Constraint} kind='required'
    | {infer Constraint} kind='optional'
    | {infer Constraint} kind='unique'
    | {infer Constraint} kind='immutable'
    | {infer Constraint} kind='ordered'
    | {infer Constraint} kind='code'
    | {infer Constraint} kind='default' '(' value=LiteralValue ')'
    | {infer Constraint} kind='min' '(' numValue=NUMBER ')'
    | {infer Constraint} kind='max' '(' numValue=NUMBER ')'
    | {infer Constraint} kind='range' '(' low=NUMBER ',' high=NUMBER ')'
    | {infer Constraint} kind='minLength' '(' numValue=NUMBER ')'
    | {infer Constraint} kind='maxLength' '(' numValue=NUMBER ')'
    | {infer Constraint} kind='pattern' '(' strValue=STRING ')'
    | {infer Constraint} kind='past'
    | {infer Constraint} kind='future'
    | {infer Constraint} kind='pastOrPresent'
    | {infer Constraint} kind='futureOrPresent';

// -----------------------------------------------------------------------------
// State Machine
// -----------------------------------------------------------------------------

StatesBlock:
    'states' '{' (machines+=StateMachineDef)* '}';

StateMachineDef:
    'machine' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        (members+=(StateDef | TransitionDef))*
    '}';

// A state carries its own invariants (which hold while the entity occupies it).
StateDef:
    kind=('state' | 'final') name=StateName
    description=Description?
    metadata=MetadataBlock?
    ('{'
        satisfies=SatisfiesDecl?
        invariants=InvariantsBlock?
    '}')?;

// `on` must be able to name EITHER operation form: an internal one (identifier) or
// a command-triggered one (its "Label" string).
//
// Conditions on a transition are named and 0..n — a precondition declares its
// violation reason, exactly as on an operation.
TransitionDef:
    source=TransitionSource '-->' target=StateName
    'on' trigger=OperationRef
    description=Description?
    metadata=MetadataBlock?
    ('{'
        satisfies=SatisfiesDecl?
        (conditions+=ConditionClause)*
    '}')?;

TransitionSource returns string:
    '[*]' | StateName;

StateName returns string:
    ID | TYPE_NAME | KeywordAsIdent;

OperationRef returns string:
    Ident | STRING;

// -----------------------------------------------------------------------------
// Operations
//
// Two forms only. There is NO event-triggered form: an event reaches a command
// only through a `reaction`.
// -----------------------------------------------------------------------------

OperationsBlock:
    'operations' '{' (ops+=OperationDef)* '}';

OperationDef:
    CommandTriggeredOp | InternalOp;

CommandTriggeredOp:
    label=STRING 'on' command=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{' body=OperationBody '}';

InternalOp:
    name=Ident '(' params=ParamList? ')' (':' returnType=FieldType)?
    description=Description?
    metadata=MetadataBlock?
    '{' body=OperationBody '}';

OperationBody:
    satisfies=SatisfiesDecl?
    safety=SafetyDecl?
    idempotent?='idempotent'?
    (clauses+=OperationClause)*;

// safe = no mutation, read-only.  unsafe = mutates domain state.
SafetyDecl returns string:
    'safe' | 'unsafe';

OperationClause:
    PreconditionClause | PostconditionClause
    | ResolvesClause | CreatesClause | SetsClause | EmitsClause
    | ServiceCallClause | ForeachClause | ReturnsClause;

// -----------------------------------------------------------------------------
// Conditions — precondition and postcondition
//
// A precondition's enforcement is implicit and always rejection, so it declares no
// strategy — but it MUST declare a violation reason (`rejects`). A postcondition
// has neither: its failure is a defect, not a domain outcome.
// -----------------------------------------------------------------------------

ConditionClause:
    PreconditionClause | PostconditionClause;

PreconditionClause:
    'precondition' name=ConditionName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        exprs+=Expression+
    '}'
    'rejects' reason=STRING;

PostconditionClause:
    'postcondition' name=ConditionName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        exprs+=Expression+
    '}';

ConditionName returns string:
    Ident | STRING;

// -----------------------------------------------------------------------------
// Operation body clauses
// -----------------------------------------------------------------------------

ResolvesClause:
    'resolves' type=TypeName 'from' source=DotPath;

CreatesClause:
    'creates' type=TypeName '{' (assignments+=AssignmentClause)* '}';

SetsClause:
    'sets' type=TypeName '{' (assignments+=AssignmentClause)* '}';

// `emits` is the concrete syntax of the event's 1..1 "raised by" relation.
EmitsClause:
    'emits' event=TypeName ('{' (assignments+=AssignmentClause)* '}')?;

AssignmentClause:
    field=Ident '=' value=ValueExpr;

ServiceCallClause:
    path=DotPath '(' args=ArgList? ')' description=Description?;

ReturnsClause:
    'returns' value=ValueExpr;

ForeachClause:
    'foreach' collection=DotPath 'as' variable=Binder '{'
        (body+=OperationClause)*
    '}';

// -----------------------------------------------------------------------------
// Command
//
// A command MUST carry an identifier — the correlation id of the causality chain
// it opens.
// -----------------------------------------------------------------------------

CommandDef:
    'command' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        identity=IdentityDecl
        fields=FieldsBlock
    '}';

// -----------------------------------------------------------------------------
// Query — safe and idempotent by definition; reads through a repository.
// -----------------------------------------------------------------------------

QueryDef:
    'query' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        readsFrom=ReadsFromClause
        fields=FieldsBlock
        'returns' returnType=FieldType
    '}';

ReadsFromClause:
    'reads-from' repository=TypeName;

// -----------------------------------------------------------------------------
// Event (internal)
//
//   about     — the entity this event is a fact about
//   caused-by — the command or query that originated it
// -----------------------------------------------------------------------------

EventDef:
    'event' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        about=AboutClause?
        causedBy=CausedByClause?
        fields=FieldsBlock
    '}';

AboutClause:
    'about' entity=TypeName;

CausedByClause:
    'caused-by' cause=TypeName;

// -----------------------------------------------------------------------------
// External Event
//
// Consumed THROUGH A REACTION, exactly like an internal event. There is no
// `triggers` clause naming commands directly — that would skip the reaction's
// guard, which is what lets this context decide whether the upstream fact still
// matters to it.
// -----------------------------------------------------------------------------

ExternalEventDef:
    'external' 'event' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        'from' source=(TypeName | STRING)
        about=AboutClause?
        fields=FieldsBlock
    '}';

// -----------------------------------------------------------------------------
// Error Event — raised by an operation on failure
// -----------------------------------------------------------------------------

ErrorEventDef:
    'error' 'event' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        about=AboutClause?
        causedBy=CausedByClause?
        fields=FieldsBlock
    '}';

// -----------------------------------------------------------------------------
// Temporal Event — a domain fact caused by the passage of time.
//
// Time alone is never the cause: every temporal event is anchored to a domain
// reference. `about` binds the entity whose state the guard reads.
//
// One rule with three anchor alternatives (rather than three rules) — the three
// flavors are identical up to the anchor keyword, which an LL parser must not
// have to backtrack past.
// -----------------------------------------------------------------------------

TemporalEventDef:
    'temporal' 'event' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        about=AboutClause?
        anchor=TemporalAnchor
        guard=GuardBlock?
        fields=FieldsBlock
    '}';

TemporalAnchor:
    RelativeAnchor | AbsoluteAnchor | RecurringAnchor;

RelativeAnchor:
    'reference' event=TypeName 'offset' offset=ValueExpr;

AbsoluteAnchor:
    'instant' instant=DotPath;

RecurringAnchor:
    'schedule' schedule=STRING;

// Evaluated at firing time. If false the event is silently suppressed — no fact is
// recorded and no reaction triggers. This absorbs cancellation.
GuardBlock:
    'guard' '{' expr=Expression '}';

// -----------------------------------------------------------------------------
// Services
// -----------------------------------------------------------------------------

DomainServiceDef:
    'domain' 'service' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        calls=CallsBlock?
        operations=OperationsBlock
    '}';

// The infrastructure services this service depends on (through their SPIs).
CallsBlock:
    'calls' '{' (services+=TypeName)+ '}';

ApplicationServiceDef:
    'application' 'service' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        exposedBy=ExposedByClause?
        operations=OperationsBlock
    '}';

ExposedByClause:
    'exposed-by' interface=TypeName;

// An adapter fulfilling an SPI contract. The model records the SIGNATURES it
// provides, never an adapter body.
InfrastructureServiceDef:
    'infrastructure' 'service' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        describedBy=DescribedByClause?
        operations=SignatureOperationsBlock
    '}';

DescribedByClause:
    'described-by' interface=TypeName;

SignatureOperationsBlock:
    'operations' '{' (ops+=OperationSignature)* '}';

// -----------------------------------------------------------------------------
// Repository — a persistence port DERIVED from an entity or aggregate root.
// A repository derived from a read-only entity is itself `read-only`.
// -----------------------------------------------------------------------------

RepositoryDef:
    readOnly?='read-only'? 'repository' name=TypeName 'for' entity=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        describedBy=DescribedByClause?
        (ops+=OperationSignature)*
    '}';

// -----------------------------------------------------------------------------
// Reaction — THE ONLY WAY AN EVENT CAUSES A COMMAND.
//
// Uniform across all four event types: internal, external, error, temporal.
// -----------------------------------------------------------------------------

ReactionDef:
    'reaction' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        triggeredBy=TriggeredByClause
        guard=GuardBlock?
        effects=EffectsClause
    '}';

TriggeredByClause:
    'triggered-by' events+=TypeName (',' events+=TypeName)*;

EffectsClause:
    'effects' command=TypeName;

// -----------------------------------------------------------------------------
// Invariant — EVERY invariant declares its enforcement strategy.
// -----------------------------------------------------------------------------

InvariantDef:
    'invariant' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        'on' scope=DotPath
        must=MustBlock
        'enforcement' enforcement=EnforcementStrategy
    '}';

MustBlock:
    'must' '{' expr=Expression '}';

EnforcementStrategy:
    {infer EnforcementStrategy} kind='rejection'
    | {infer EnforcementStrategy} kind='compensation' type=TypeName
    | {infer EnforcementStrategy} kind='alert';

InvariantsBlock:
    'invariants' '{' (invariants+=ScopedInvariantDef)* '}';

// Inside an `invariants { }` block the owner is the enclosing entity, aggregate,
// value type or state, so no `on` clause is needed.
ScopedInvariantDef:
    name=Ident ('(' params=ParamList? ')')?
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        expr=Expression
        'enforcement' enforcement=EnforcementStrategy
    '}';

// -----------------------------------------------------------------------------
// Agreement — a property spanning several aggregates. Bilateral (2) or
// multilateral (n) — never unilateral.
// -----------------------------------------------------------------------------

AgreementDef:
    'agreement' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        participants=ParticipantsClause
        predicate=PredicateBlock
        reconciliation=ReconciliationDef
    '}';

ParticipantsClause:
    'participants' '{'
        participants+=TypeName ',' participants+=TypeName
        (',' participants+=TypeName)*
    '}';

PredicateBlock:
    'predicate' '{' expr=Expression '}';

// -----------------------------------------------------------------------------
// Reconciliation — the enforcement counterpart of an agreement
// -----------------------------------------------------------------------------

ReconciliationDef:
    'reconciliation' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        'trigger' trigger=ReconciliationTrigger
        'detection' detection=DetectionStrategy
        compensation=CompensationClause
        ('coordination' coordination=CoordinationStyle)?
        escalation=EscalationChainDef?
    '}';

ReconciliationTrigger:
    {infer ReconciliationTrigger} 'event' events+=TypeName (',' events+=TypeName)*
    | {infer ReconciliationTrigger} 'schedule' schedule=STRING;

DetectionStrategy returns string:
    'query' | 'event-sourced';

CompensationClause:
    'compensation' '{' commands+=TypeName (',' commands+=TypeName)* '}';

CoordinationStyle returns string:
    'choreography' | 'orchestration';

// -----------------------------------------------------------------------------
// Escalation Chain — MUST TERMINATE.
//
// VALIDATOR: the tree-sitter (GLR) grammar encodes terminality structurally as
// `{ nonTerminalStep } terminalStep`. An LL parser cannot: NonTerminalStep and
// TerminalStep are identical until the `action` keyword, which is arbitrarily far
// ahead. So Langium parses one uniform EscalationStep and the validator enforces
// that the final step's action is alert / suspend / manual — never retry or
// compensate, which could themselves fail forever.
// -----------------------------------------------------------------------------

EscalationChainDef:
    'escalation'
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        (steps+=EscalationStep)+
    '}';

EscalationStep:
    'step' name=Ident
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        'when' '{' when=Expression '}'
        'action' action=EscalationAction
    '}';

EscalationAction:
    {infer EscalationAction} kind='retry' '(' count=NUMBER ')'
    | {infer EscalationAction} kind='compensate' '{' commands+=TypeName (',' commands+=TypeName)* '}'
    | {infer EscalationAction} kind='alert' message=STRING
    | {infer EscalationAction} kind='suspend'
    | {infer EscalationAction} kind='manual' message=STRING;

// -----------------------------------------------------------------------------
// Parameters & Arguments
// -----------------------------------------------------------------------------

ParamList:
    params+=ParamDecl (',' params+=ParamDecl)*;

ParamDecl:
    name=Ident ':' type=FieldType optional?='?'?;

ArgList:
    (args+=Expression (',' args+=Expression)*)
    | namedArgs=NamedArgList;

NamedArgList:
    args+=NamedArg (',' args+=NamedArg)*;

NamedArg:
    name=Ident '=' value=ValueExpr;

// -----------------------------------------------------------------------------
// Description & Metadata
// -----------------------------------------------------------------------------

Description:
    '::' text=STRING;

MetadataBlock:
    'meta' '{' (entries+=MetadataEntry)* '}';

MetadataEntry:
    key=Ident '=' value=LiteralValue;

// -----------------------------------------------------------------------------
// Expressions
//
// Orthogonal to the metamodel, which only ever says "a predicate expression".
// Precedence, loosest to tightest:
//   ?:  <  or  <  and  <  not  <  comparison  <  + -  <  * /  <  unary
// -----------------------------------------------------------------------------

Expression:
    CoalesceExpr;

// Elvis / null-coalescing: `a ?: b` is `b` when `a` is null.
CoalesceExpr infers Expression:
    ConditionalExpr ({infer BinaryExpr.left=current} op='?:' right=ConditionalExpr)*;

ConditionalExpr infers Expression:
    OrExpr ({infer ConditionalExpr.condition=current} '?' whenTrue=Expression ':' whenFalse=Expression)?;

OrExpr infers Expression:
    AndExpr ({infer BinaryExpr.left=current} op='or' right=AndExpr)*;

AndExpr infers Expression:
    NotExpr ({infer BinaryExpr.left=current} op='and' right=NotExpr)*;

NotExpr infers Expression:
    {infer UnaryExpr} op='not' operand=Comparison
    | Comparison;

Comparison infers Expression:
    Addition ({infer BinaryExpr.left=current} op=CompOp right=Addition
        | {infer MatchesExpr.left=current} 'matches' pattern=MatchPattern
        | {infer ContainsExpr.left=current} 'does' 'not' 'contain' target=DotPath
        | {infer ContainsExpr.left=current} 'contains' target=DotPath
    )?;

MatchPattern:
    value=STRING | value=REGEX;

CompOp returns string:
    '=' | '!=' | '>' | '<' | '>=' | '<=';

Addition infers Expression:
    Multiplication ({infer BinaryExpr.left=current} op=('+' | '-') right=Multiplication)*;

Multiplication infers Expression:
    UnaryExpr ({infer BinaryExpr.left=current} op=('*' | '/') right=UnaryExpr)*;

UnaryExpr infers Expression:
    IfExpr
    | EveryExpr
    | QuantifierExpr
    | IsDefinedExpr
    | IsNotDefinedExpr
    | IsNullExpr
    | IsNotNullExpr
    | InExpr
    | NotInExpr
    | DurationLiteral
    | DotPathOrCallExpr
    | Literal
    | ParenExpr;

// Parse a DotPath first, then optionally upgrade it to a call. A built-in function
// and a service call are syntactically identical — telling them apart needs a
// symbol table, not the grammar.
//
// Built-ins: count, sum, min, max, avg, abs, size, isEmpty, isNotEmpty, append,
//            now, today.
DotPathOrCallExpr infers Expression:
    {infer DotPathExpr} path=DotPath (
        {infer CallExpr.path=current} '(' args=ArgList? ')'
    )?;

// if — logical implication (if A then B ≡ not A or B).
// Two spellings: the braced form, and a then/else form that yields a value.
IfExpr:
    'if' condition=Expression (
        '{' body=Expression '}'
        | 'then' whenTrue=Expression 'else' whenFalse=Expression
    );

// every — universal quantifier. The binder is an identifier, matching
// `foreach ... as <identifier>`.
//
// The binder accepts TypeName as well as Ident: the grammar's `identifier` is
// camelCase OR PascalCase, and the lexer tries TYPE_NAME before ID, so a binder
// written `every Product in lines` lexes as TYPE_NAME and would not otherwise parse.
EveryExpr:
    'every' variable=Binder 'in' collection=DotPath '{' body=Expression '}';

QuantifierExpr:
    kind=('exists' | 'forall') variable=Binder 'in' collection=DotPath
    ('where' predicate=Expression)?;

Binder returns string:
    Ident | TypeName;

IsDefinedExpr:    path=DotPath 'is' 'defined';
IsNotDefinedExpr: path=DotPath 'is' 'not' 'defined';
IsNullExpr:       path=DotPath 'is' 'null';
IsNotNullExpr:    path=DotPath 'is' 'not' 'null';

InExpr:    path=DotPath 'in' '{' values=ValueList '}';
NotInExpr: path=DotPath 'not' 'in' '{' values=ValueList '}';

ParenExpr:
    '(' expr=Expression ')';

// Spaced form: `5 minutes`. Compact form: `5min`, `24h`, `2businessDays`.
DurationLiteral:
    amount=NUMBER unit=DurationUnit;

DurationUnit returns string:
    'months' | 'days' | 'years' | 'hours' | 'minutes' | 'seconds' | 'weeks'
    | 'ms' | 's' | 'min' | 'h' | 'd' | 'w' | 'y'
    | 'businessDay' | 'businessDays';

// -----------------------------------------------------------------------------
// Dot-path — `?.` is safe navigation; `[expr]` subscripts a collection.
// -----------------------------------------------------------------------------

DotPath:
    segments+=PathSegment (('.' | '?.') segments+=PathSegment)*;

PathSegment:
    value=(ID | KeywordAsIdent | TypeName | STRING) index=ArrayIndex?;

ArrayIndex:
    '[' expr=Expression ']';

// -----------------------------------------------------------------------------
// Value expressions
//
// Service calls are already produced by Expression (via DotPathOrCallExpr), so a
// standalone ServiceCallExpr alternative here would be an unresolvable LL conflict
// — both start with a DotPath.
//
// NOTE (known limitation): value constructors (`TypeName { field = value }`) cannot
// be parsed by an LL parser in expression position — ambiguous with `{ }` blocks in
// if/every expressions. The tree-sitter GLR parser handles them.
// -----------------------------------------------------------------------------

ValueExpr:
    ArrayLiteral | Expression;

ArrayLiteral:
    '[' first=ValueExpr (',' more+=ValueExpr)* ']';

ValueList:
    values+=ValueExpr (',' values+=ValueExpr)*;

// -----------------------------------------------------------------------------
// Literals
// -----------------------------------------------------------------------------

LiteralValue:
    StringLiteral | NumberLiteral | BooleanLiteral;

Literal infers Expression:
    {infer StringLiteralExpr} value=STRING
    | {infer NumberLiteralExpr} value=NUMBER
    | {infer BooleanLiteralExpr} value=('true' | 'false')
    | {infer NullLiteralExpr} value='null';

StringLiteral:  value=STRING;
NumberLiteral:  value=NUMBER;
BooleanLiteral: value=('true' | 'false');

// -----------------------------------------------------------------------------
// Helper rules for identifiers
//
// Keywords that may also appear as field names, identifiers, or dot-path segments.
// Langium reserves every keyword, so each needs an explicit escape hatch (the
// tree-sitter grammar's general identifier regex subsumes them for free).
// -----------------------------------------------------------------------------

KeywordAsIdent returns string:
    'value' | 'type' | 'status' | 'id' | 'code' | 'name' | 'message'
    | 'required' | 'optional' | 'unique' | 'immutable' | 'ordered'
    | 'state' | 'final' | 'event' | 'command' | 'query' | 'entity' | 'aggregate'
    | 'enum' | 'module' | 'context' | 'organization' | 'interface' | 'service'
    | 'domain' | 'application' | 'infrastructure' | 'repository' | 'reaction'
    | 'invariant' | 'agreement' | 'reconciliation' | 'escalation' | 'step'
    | 'machine' | 'states' | 'fields' | 'entities' | 'operations' | 'invariants'
    | 'references' | 'identity' | 'satisfies' | 'meta' | 'map'
    | 'api' | 'spi' | 'exposes' | 'requires' | 'describes' | 'depends'
    | 'about' | 'schedule' | 'reference' | 'offset' | 'instant' | 'guard'
    | 'trigger' | 'detection' | 'compensation' | 'coordination' | 'participants'
    | 'predicate' | 'action' | 'when' | 'must' | 'enforcement' | 'rejects'
    | 'precondition' | 'postcondition' | 'safe' | 'unsafe' | 'idempotent'
    | 'creates' | 'sets' | 'emits' | 'resolves' | 'returns' | 'foreach'
    | 'from' | 'on' | 'as' | 'of' | 'for' | 'calls' | 'where'
    | 'upstream' | 'downstream' | 'symmetric' | 'external' | 'error' | 'temporal'
    | 'not' | 'and' | 'or' | 'in' | 'is' | 'if' | 'every' | 'exists' | 'forall'
    | 'true' | 'false' | 'null'
    | 'alert' | 'suspend' | 'manual' | 'retry' | 'compensate'
    | 'rejection' | 'choreography' | 'orchestration'
    | 'string' | 'int' | 'integer' | 'long' | 'decimal' | 'boolean'
    | 'date' | 'datetime' | 'time' | 'duration' | 'uuid' | 'void'
    | 'list' | 'set'
    | 'default' | 'min' | 'max' | 'range' | 'minLength' | 'maxLength' | 'pattern'
    | 'past' | 'future' | 'pastOrPresent' | 'futureOrPresent'
    | 'months' | 'days' | 'years' | 'hours' | 'minutes' | 'seconds' | 'weeks';

FieldName returns string:
    ID | KeywordAsIdent;

Ident returns string:
    ID | KeywordAsIdent;

TypeName returns string:
    TYPE_NAME;

// -----------------------------------------------------------------------------
// Hidden terminals
// -----------------------------------------------------------------------------

hidden terminal WS: /\s+/;
hidden terminal SL_COMMENT: /\/\/[^\n]*/;
hidden terminal HASH_COMMENT: /#[^\n]*/;

// -----------------------------------------------------------------------------
// Terminals
// -----------------------------------------------------------------------------

terminal REQUIREMENT_ID: /REQ-[A-Z][A-Z0-9]*(-[A-Z][A-Z0-9]*)*-\d{3}/;
terminal CARDINALITY: /\d+\.\.(\d+|[nN])/;
// PascalCase type names. The trailing `(?!\w)` stops TYPE_NAME from claiming the
// uppercase prefix of an UPPER_SNAKE_CASE identifier (e.g. matching `UNDER` inside
// `UNDER_REVIEW`): TYPE_NAME has no underscore and is tried before ID, so
// first-match would otherwise split the token at the underscore.
terminal TYPE_NAME: /[A-Z][a-zA-Z0-9]*(?!\w)/;
terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
terminal STRING: /"[^"]*"/;
terminal NUMBER: /-?\d+(\.\d+)?/;
// REGEX matches bracket expressions like [a-zA-Z0-9-]+ used by `matches`.
// Two restrictions keep this from swallowing other `[...]` uses the parser needs as
// real brackets:
//   1. require a lowercase letter inside, so [REQ-XXX-NNN] is not a regex;
//   2. require a trailing quantifier, so array literals (`[foo]`) and subscripts
//      (`[i]`) — which never end in a quantifier — lex as brackets.
terminal REGEX: /\[[^\]]*[a-z][^\]]*\][*+?]/;
