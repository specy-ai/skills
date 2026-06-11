// =============================================================================
// Specy Domain Model Grammar (.domain)
// Langium grammar — translated from tree-sitter grammar.js (v1.0.0)
// =============================================================================

grammar SpecyDomain

// -----------------------------------------------------------------------------
// Top-level
// -----------------------------------------------------------------------------

entry DomainFile:
    (elements+=TopLevelElement)*;

TopLevelElement:
    OrganizationDef | ContextDef | ModuleDef | Definition;

// -----------------------------------------------------------------------------
// Organization
// -----------------------------------------------------------------------------

OrganizationDef:
    'organization' name=(TypeName | STRING)
    description=Description?
    metadata=MetadataBlock?
    '{'
        (sources+=SourceDecl)*
        (contexts+=ContextDef)*
    '}';

SourceDecl:
    RequirementsSourceDecl | PrdSourceDecl;

RequirementsSourceDecl:
    'requirements-source' path=STRING;

PrdSourceDecl:
    'prd-source' path=STRING;

// -----------------------------------------------------------------------------
// Bounded Context
// -----------------------------------------------------------------------------

ContextDef:
    'context' name=(TypeName | STRING)
    shortname=Shortname?
    description=Description?
    metadata=MetadataBlock?
    '{'
        (sources+=SourceDecl)*
        contextMap=ContextMapBlock?
        (members+=(ModuleDef | Definition))*
    '}';

Shortname:
    '(' value=Ident ')'
    | 'shortname' value=(Ident | TypeName);

// -----------------------------------------------------------------------------
// Context Map
// -----------------------------------------------------------------------------

ContextMapBlock:
    'map' '{'
        (relations+=ContextRelation)*
    '}';

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
// -----------------------------------------------------------------------------

ModuleDef:
    'module' name=(TypeName | STRING)
    description=Description?
    metadata=MetadataBlock?
    (usesDecls+=UsesDecl)*
    (reqSources+=RequirementsSourceDecl)*
    (body=ModuleBody)?;

ModuleBody:
    '{'
        dependsBlock=DependsBlock?
        (members+=(ModuleDef | InterfaceDef | Definition))*
    '}';

UsesDecl:
    'uses' 'module' module=TypeName;

DependsBlock:
    'depends' 'on' '{'
        (deps+=(TypeName | STRING))*
    '}';

// -----------------------------------------------------------------------------
// Interface
// -----------------------------------------------------------------------------

InterfaceDef:
    'interface' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        (members+=(ExposesClause | NamedOperationDef))*
    '}';

ExposesClause:
    'exposes' path=DotPath;

// -----------------------------------------------------------------------------
// Definitions — all domain concepts within a module
// -----------------------------------------------------------------------------

Definition:
    EnumDef | ValueDef | EntityDef | AggregateDef
    | StatemachineDef
    | CommandDef | QueryDef
    | EventDef | ExternalEventDef | ErrorEventDef | TemporalEventDef
    | DomainServiceDef | ApplicationServiceDef | InfrastructureServiceDef | ServiceDef
    | InvariantDef
    | AgreementDef
    | ReactionDef;

// -----------------------------------------------------------------------------
// Enum
// -----------------------------------------------------------------------------

EnumDef:
    'enum' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        (values+=EnumValue)+
    '}';

EnumValue:
    value=(Ident | TypeName) ','?;

// Inline enum (no name, inside value body)
InlineEnumBlock:
    'enum' '{'
        first=TypeName (',' more+=TypeName)* ','?
    '}';

// -----------------------------------------------------------------------------
// Satisfies — traceability link to requirements
// -----------------------------------------------------------------------------

SatisfiesDecl:
    'satisfies' '['
        ids+=REQUIREMENT_ID (',' ids+=REQUIREMENT_ID)*
    ']';

// -----------------------------------------------------------------------------
// Value Type — flexible body
// -----------------------------------------------------------------------------

ValueDef:
    'value' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        (bodyItems+=ValueBodyItem)*
    '}';

ValueBodyItem:
    SatisfiesDecl | Description | FieldDecl | FieldsBlock
    | InlineEnumBlock | InlineInvariant | InvariantsBlock | ValueOperationsBlock;

ValueOperationsBlock:
    'operations' '{'
        (ops+=ValueOpDef)*
    '}';

ValueOpDef:
    name=Ident '(' params=ParamList? ')' ':' returnType=FieldType
    description=Description?
    metadata=MetadataBlock?;

// -----------------------------------------------------------------------------
// Entity — flexible body
// -----------------------------------------------------------------------------

EntityDef:
    'entity' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        (bodyItems+=EntityBodyItem)*
    '}';

EntityBodyItem:
    SatisfiesDecl | Description | FieldDecl | FieldsBlock
    | IdentityDecl | DuplicateDetection
    | NamedOperationDef | OperationsBlock
    | InlineInvariant | InvariantsBlock
    | ReactionsBlock | StatesBlock | TransitionsBlock | ReferencesBlock;

IdentityDecl:
    ('identity' | 'identifier') name=Ident ':' type=FieldType;

DuplicateDetection:
    'duplicate' 'detection' '{' expr=Expression '}';

// -----------------------------------------------------------------------------
// Aggregate — flexible body
// -----------------------------------------------------------------------------

AggregateDef:
    'aggregate' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        (bodyItems+=AggregateBodyItem)*
    '}';

AggregateBodyItem:
    SatisfiesDecl | Description
    | AggregateRootDecl | AggregateEntitiesDecl | AggregateContainsDecl
    | IdentityDecl | DuplicateDetection
    | FieldDecl | FieldsBlock | ReferencesBlock
    | InvariantsBlock | ReactionsBlock
    | OperationsBlock | StatesBlock | TransitionsBlock;

AggregateRootDecl:
    'root' root=TypeName;

AggregateEntitiesDecl:
    'entities' '{' (entities+=TypeName)* '}';

AggregateContainsDecl:
    'contains' first=TypeName (',' more+=TypeName)*;

// -----------------------------------------------------------------------------
// Statemachine (top-level, flat form)
// -----------------------------------------------------------------------------

StatemachineDef:
    'statemachine' name=TypeName
    '{'
        (items+=StatemachineItem)*
    '}';

StatemachineItem:
    OnClause | StatemachineStart | StateDef | TransitionInline | FinalState;

StatemachineStart:
    'start' state=TypeName;

StateDef:
    'state' name=TypeName
    '{'
        (invariants+=InlineInvariant)*
    '}';

TransitionInline:
    'transition' from=TypeName '->' to=TypeName
    'triggered-by' trigger=STRING;

FinalState:
    'final' state=TypeName;

// -----------------------------------------------------------------------------
// Reaction
// -----------------------------------------------------------------------------

ReactionDef:
    'reaction' name=(Ident | TypeName | STRING)
    ('(' params=ParamList ')')?
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        // Either clause items (triggered-by/trigger/effects/effect/guard) or a single
        // bare guard expression (the scoped-reaction form, formerly `policy name { expr }`).
        // Item keywords and expression starts are disjoint, so the loop exit is LL-decidable;
        // the guard expression is parsed once (never repeated) to avoid expression ambiguity.
        (items+=ReactionItem)*
        (guard=Expression)?
    '}';

ReactionItem:
    Description | TriggeredByClause | EffectsClause | TriggerClause | GuardClause | EffectClause;

TriggeredByClause:
    'triggered-by' event=TypeName;

EffectsClause:
    'effects' command=TypeName;

TriggerClause:
    'trigger' event=TypeName (',' more+=TypeName)*;

GuardClause:
    'guard' '{' expr=Expression '}';

EffectClause:
    'effect' command=TypeName;

// -----------------------------------------------------------------------------
// Named Operation (inline in entity/service/interface)
// operation "name" { on X, accepts ..., returns ..., emits ... }
// -----------------------------------------------------------------------------

NamedOperationDef:
    'operation' name=STRING
    '{'
        (items+=NamedOpItem)*
    '}';

NamedOpItem:
    SatisfiesDecl | Description | OnClause | AcceptsClause
    | ReturnsDecl | EmitsClause | NamedPrecondition | NamedPostcondition;

OnClause:
    'on' type=TypeName;

AcceptsClause:
    'accepts' first=ParamDeclOpt (',' more+=ParamDeclOpt)*;

ParamDeclOpt:
    name=Ident ':' type=FieldType optional?='?'?;

ReturnsDecl:
    'returns' type=FieldTypeOpt;

FieldTypeOpt:
    type=FieldType optional?='?'?;

EmitsClause:
    'emits' event=TypeName
    ('{' (assignments+=AssignmentClause)* '}')?;

NamedPrecondition:
    'precondition' name=STRING
    '{'
        expr=Expression
        ('violation' message=STRING)?
    '}';

NamedPostcondition:
    'postcondition' name=STRING
    '{'
        expr=Expression
    '}';

// -----------------------------------------------------------------------------
// Inline Invariant (inside value/entity/statemachine bodies)
// -----------------------------------------------------------------------------

InlineInvariant:
    'invariant' name=STRING
    '{'
        satisfies=SatisfiesDecl?
        description=Description?
        on=OnClause?
        must=MustBlock?
        ('message' message=STRING)?
        ('enforcement' enforcement=EnforcementValue)?
    '}';

MustBlock:
    'must' '{' expr=Expression '}';

EnforcementValue returns string:
    'reject' | 'warn' | 'rejection' | 'compensation' | 'alert';

// -----------------------------------------------------------------------------
// Fields & References
// -----------------------------------------------------------------------------

FieldsBlock:
    'fields' '{' (fields+=FieldDecl)* '}';

FieldDecl:
    name=FieldName ':' type=FieldType optional?='?'?
    (constraints+=Constraint)*;

// Keywords that can also appear as field names, identifiers, or dot-path segments.
// The tree-sitter grammar uses a general /[a-zA-Z_][a-zA-Z0-9_]*/ identifier that
// subsumes keywords; Langium needs an explicit escape-hatch for each.
KeywordAsIdent returns string:
    'required' | 'optional' | 'value' | 'type' | 'status' | 'id'
    | 'message' | 'name' | 'identifier' | 'trigger' | 'effect' | 'start'
    | 'action' | 'state' | 'event' | 'command' | 'query' | 'schedule'
    | 'reference' | 'offset' | 'instant' | 'guard'
    | 'from' | 'on' | 'when' | 'then' | 'as' | 'root' | 'final'
    | 'fields' | 'entities' | 'contains' | 'exposes' | 'accepts' | 'returns'
    | 'emits' | 'creates' | 'sets' | 'resolves' | 'precondition'
    | 'postcondition' | 'foreach' | 'invariant' | 'agreement' | 'predicate'
    | 'participants' | 'reconciliation' | 'detection' | 'compensation'
    | 'coordination' | 'escalation' | 'step' | 'condition'
    | 'must' | 'enforcement' | 'violation'
    | 'module' | 'context' | 'organization' | 'interface'
    | 'entity' | 'aggregate' | 'service' | 'enum' | 'statemachine'
    | 'transition' | 'machine' | 'reaction' | 'operation'
    | 'satisfies' | 'depends' | 'uses' | 'map'
    | 'upstream' | 'downstream' | 'symmetric'
    | 'external' | 'error' | 'temporal' | 'domain' | 'application' | 'infrastructure'
    | 'internal' | 'not' | 'and' | 'or' | 'in' | 'is' | 'if' | 'every' | 'no' | 'field'
    | 'count' | 'sum' | 'now' | 'today' | 'size' | 'isEmpty' | 'isNotEmpty' | 'append'
    | 'true' | 'false'
    | 'reject' | 'warn' | 'alert' | 'suspend' | 'manual'
    | 'retry' | 'compensate' | 'shortname'
    | 'void' | 'string' | 'int' | 'integer' | 'long' | 'decimal' | 'boolean'
    | 'date' | 'datetime' | 'time' | 'duration' | 'uuid'
    | 'list' | 'set' | 'unique' | 'immutable' | 'ordered'
    | 'default' | 'min' | 'max' | 'range' | 'minLength' | 'maxLength' | 'pattern'
    | 'past' | 'future' | 'pastOrPresent' | 'futureOrPresent'
    | 'months' | 'days' | 'years' | 'hours' | 'minutes' | 'seconds' | 'weeks'
    | 'some' | 'forall' | 'exists' | 'where'
    | 'number' | 'active' | 'searching' | 'cancelled';

FieldName returns string:
    ID | KeywordAsIdent;

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

Constraint:
    {infer Constraint} kind='required'
    | {infer Constraint} kind='optional'
    | {infer Constraint} kind='unique'
    | {infer Constraint} kind='immutable'
    | {infer Constraint} kind='ordered'
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

ReferencesBlock:
    'references' '{' (refs+=ReferenceDecl)* '}';

ReferenceDecl:
    name=Ident ':' target=TypeName cardinality=CARDINALITY;

// -----------------------------------------------------------------------------
// Operations (classic block-based)
// "Label" on CommandType { ... }
// "Label" when EventType then CommandType { ... }
// name(params) : ReturnType { ... }
// -----------------------------------------------------------------------------

OperationsBlock:
    'operations' '{' (ops+=OperationDef)* '}';

OperationDef:
    CommandTriggeredOp | EventTriggeredOp | InternalOp;

CommandTriggeredOp:
    label=STRING 'on' command=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        (clauses+=OperationClause)*
    '}';

EventTriggeredOp:
    label=STRING 'when' event=TypeName 'then' command=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        (clauses+=OperationClause)*
    '}';

InternalOp:
    name=(Ident | STRING) '(' params=ParamList? ')' (':' returnType=FieldType)?
    description=Description?
    metadata=MetadataBlock?
    ('{'
        satisfies=SatisfiesDecl?
        (clauses+=OperationClause)*
    '}')?;

OperationClause:
    PreconditionClause | PostconditionClause
    | ResolvesClause | ReactionCallClause
    | CreatesClause | SetsClause | EmitsClause
    | ServiceCallClause | ForeachClause | ReturnsClause;

// -----------------------------------------------------------------------------
// Operation Clauses
// -----------------------------------------------------------------------------

PreconditionClause:
    'precondition' name=Ident
    description=Description?
    metadata=MetadataBlock?
    '{'
        expr=Expression
    '}'
    'rejects' message=STRING;

PostconditionClause:
    'postcondition' name=Ident
    description=Description?
    metadata=MetadataBlock?
    '{'
        expr=Expression
    '}';

ResolvesClause:
    'resolves' type=TypeName 'from' source=DotPath;

ReactionCallClause:
    'reaction' name=Ident
    '(' args=ArgList? ')'
    description=Description?
    metadata=MetadataBlock?
    ('{' expr=Expression '}')?;

CreatesClause:
    'creates' type=TypeName '{'
        (assignments+=AssignmentClause)*
    '}';

SetsClause:
    'sets' type=TypeName '{'
        (assignments+=AssignmentClause)*
    '}';

AssignmentClause:
    field=Ident '=' value=ValueExpr;


ReturnsClause:
    'returns' (
        (returnName=Ident ':' returnType=FieldType)
        | returnType=FieldType
        | value=ValueExpr
    );

ServiceCallClause:
    path=DotPath '(' args=ArgList? ')'
    description=Description?;

ForeachClause:
    'foreach' collection=DotPath 'as' variable=Ident '{'
        (body+=(ResolvesClause | SetsClause | EmitsClause
            | ServiceCallClause | ReactionCallClause))*
    '}';

// -----------------------------------------------------------------------------
// State Machine (classic block-based)
// -----------------------------------------------------------------------------

StatesBlock:
    'states' '{' (machines+=StateMachineDef)* '}';

StateMachineDef:
    'machine' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        (members+=(ClassicStateDef | ClassicTransitionDef))*
    '}';

ClassicStateDef:
    kind=('state' | 'final') name=Ident
    description=Description?
    metadata=MetadataBlock?
    ('{' (invariants+=StateInvariantDef)* '}')?;

StateInvariantDef:
    'invariant' name=Ident
    description=Description?
    metadata=MetadataBlock?
    '{'
        expr=Expression
    '}';

ClassicTransitionDef:
    source=TransitionSource '-->' target=Ident
    'on' trigger=Ident
    ('when' '{' guard=Expression '}')?
    ('then' '{' action=Expression '}')?;

TransitionSource returns string:
    '[*]' | ID;

// -----------------------------------------------------------------------------
// Transitions (entity-level shorthand)
// -----------------------------------------------------------------------------

TransitionsBlock:
    'transitions' '{' (transitions+=EntityTransition)* '}';

EntityTransition:
    source=TransitionSource '-->' target=Ident
    ('on' triggers+=STRING (',' triggers+=STRING)*)?;

// -----------------------------------------------------------------------------
// Command — flexible body
// -----------------------------------------------------------------------------

CommandDef:
    'command' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        (bodyItems+=RecordBodyItem)*
    '}';

RecordBodyItem:
    SatisfiesDecl | Description | FieldDecl | FieldsBlock;

// -----------------------------------------------------------------------------
// Query — flexible body
// -----------------------------------------------------------------------------

QueryDef:
    'query' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        (bodyItems+=QueryBodyItem)*
    '}';

QueryBodyItem:
    SatisfiesDecl | Description | FieldDecl | FieldsBlock | ReturnsDecl;

// -----------------------------------------------------------------------------
// Event — flexible body with type classifier
// -----------------------------------------------------------------------------

EventDef:
    'event' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        (bodyItems+=EventBodyItem)*
    '}';

EventBodyItem:
    SatisfiesDecl | Description | EventTypeClassifier
    | FieldDecl | FieldsBlock
    | EventSchedule | EventInstant | EventGuard;

EventTypeClassifier:
    'type' classifier=('internal' | 'external' | 'error' | 'temporal');

EventSchedule:
    'schedule' expr=STRING;

EventInstant:
    'instant' path=DotPath;

EventGuard:
    'guard' '{' expr=Expression '}';

// -----------------------------------------------------------------------------
// External Event
// -----------------------------------------------------------------------------

ExternalEventDef:
    'external' 'event' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        'from' from=TypeName
        'triggers' '{' first=TypeName (',' more+=TypeName)* '}'
    '}';

// -----------------------------------------------------------------------------
// Error Event — flexible body
// -----------------------------------------------------------------------------

ErrorEventDef:
    'error' 'event' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        (bodyItems+=EventBodyItem)*
    '}';

// -----------------------------------------------------------------------------
// Temporal Events
// -----------------------------------------------------------------------------

TemporalEventDef:
    RelativeTemporalEvent | AbsoluteTemporalEvent | RecurringTemporalEvent;

RelativeTemporalEvent:
    'temporal' 'event' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        'reference' reference=TypeName
        'offset' offset=ValueExpr
        ('guard' '{' guard=Expression '}')?
        fields=FieldsBlock
    '}';

AbsoluteTemporalEvent:
    'temporal' 'event' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        'instant' instant=DotPath
        ('guard' '{' guard=Expression '}')?
        fields=FieldsBlock
    '}';

RecurringTemporalEvent:
    'temporal' 'event' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        'schedule' schedule=STRING
        ('guard' '{' guard=Expression '}')?
        fields=FieldsBlock
    '}';

// -----------------------------------------------------------------------------
// Services — flexible body
// -----------------------------------------------------------------------------

DomainServiceDef:
    ('domain-service' | 'domain' 'service') name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        (bodyItems+=ServiceBodyItem)*
    '}';

ApplicationServiceDef:
    ('application-service' | 'application' 'service') name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        (bodyItems+=ServiceBodyItem)*
    '}';

InfrastructureServiceDef:
    ('infrastructure-service' | 'infrastructure' 'service') name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        (bodyItems+=ServiceBodyItem)*
    '}';

ServiceDef:
    'service' name=TypeName
    description=Description?
    metadata=MetadataBlock?
    '{'
        (bodyItems+=ServiceBodyItem)*
    '}';

ServiceBodyItem:
    SatisfiesDecl | Description
    | NamedOperationDef | OperationsBlock
    | InterfaceDef | InvariantsBlock | ReactionsBlock;

// (Reactive rules are defined by `ReactionDef` above; the legacy `PolicyDef`
// and `ScopedPolicyDef` forms were folded into it.)

// -----------------------------------------------------------------------------
// Invariant (top-level)
// -----------------------------------------------------------------------------

InvariantDef:
    'invariant' name=(TypeName | STRING)
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        innerDescription=Description?
        on=OnClause?
        must=MustBlock?
        ('message' message=STRING)?
        ('enforcement' enforcement=EnforcementValue)?
        enforcementStrategy=EnforcementStrategy?
    '}';

EnforcementStrategy:
    {infer EnforcementStrategy} kind='rejection'
    | {infer EnforcementStrategy} kind='compensation' type=TypeName
    | {infer EnforcementStrategy} kind='alert';

InvariantsBlock:
    'invariants' '{' (invariants+=ScopedInvariantDef)* '}';

ReactionsBlock:
    'reactions' '{' (reactions+=ScopedInvariantDef)* '}';

ScopedInvariantDef:
    name=Ident
    ('(' params=ParamList ')')?
    description=Description?
    metadata=MetadataBlock?
    '{'
        satisfies=SatisfiesDecl?
        expr=Expression?
    '}';

// -----------------------------------------------------------------------------
// Agreement
// -----------------------------------------------------------------------------

AgreementDef:
    'agreement' name=(TypeName | STRING)
    description=Description?
    metadata=MetadataBlock?
    '{'
        (items+=AgreementItem)*
    '}';

AgreementItem:
    SatisfiesDecl | Description | ParticipantsClause
    | PredicateBlock | ReconciliationDef;

ParticipantsClause:
    'participants' first=TypeName (',' more+=TypeName)*;

PredicateBlock:
    'predicate' '{' expr=PredicateExpr '}';

PredicateExpr:
    ForallPred | {infer PredicateExpr} expression=Expression;

ForallPred:
    'forall' type=TypeName ('where' where=Expression)?
    ':' (exists=ExistsPred | body=Expression);

ExistsPred:
    'exists' type=TypeName ('where' where=Expression)?;

// -----------------------------------------------------------------------------
// Reconciliation
// -----------------------------------------------------------------------------

ReconciliationDef:
    'reconciliation' name=(TypeName | STRING)
    description=Description?
    metadata=MetadataBlock?
    '{'
        (items+=ReconciliationItem)*
    '}';

ReconciliationItem:
    ReconciliationTriggerClause | DetectionClause
    | CompensationClause | CoordinationClause | EscalationChainDef;

ReconciliationTriggerClause:
    'trigger' trigger=ReconciliationTrigger;

ReconciliationTrigger:
    {infer ReconciliationTrigger} 'event' events+=TypeName (',' events+=TypeName)*
    | {infer ReconciliationTrigger} 'schedule' schedule=STRING;

DetectionClause:
    'detection' strategy=DetectionStrategy;

DetectionStrategy returns string:
    'query' | 'event-sourced' | 'query-based';

CompensationClause:
    'compensation' types+=TypeName (',' types+=TypeName)*;

CoordinationClause:
    'coordination' style=CoordinationStyle;

CoordinationStyle returns string:
    'choreography' | 'orchestration';

// -----------------------------------------------------------------------------
// Escalation Chain
// -----------------------------------------------------------------------------

EscalationChainDef:
    'escalation'
    description=Description?
    metadata=MetadataBlock?
    '{'
        (steps+=EscalationStep)+
    '}';

EscalationStep:
    'step' name=(Ident | NUMBER)
    description=Description?
    metadata=MetadataBlock?
    '{'
        (items+=EscalationStepItem)*
    '}';

EscalationStepItem:
    EscalationCondition | EscalationActionClause
    | EscalationMaxAttempts | EscalationWhen | EscalationThen;

EscalationCondition:
    'condition' message=STRING;

EscalationActionClause:
    'action' action=EscalationAction;

EscalationMaxAttempts:
    'max-attempts' count=NUMBER;

EscalationWhen:
    'when' '{' expr=Expression '}';

EscalationThen:
    'then' '{' expr=Expression '}';

EscalationAction:
    {infer EscalationAction} kind='retry' ('(' count=NUMBER ')')?
    | {infer EscalationAction} kind='compensate' ('{' types+=TypeName (',' types+=TypeName)* '}' | type=TypeName)
    | {infer EscalationAction} kind='alert' message=STRING?
    | {infer EscalationAction} kind='suspend'
    | {infer EscalationAction} kind='manual' message=STRING?
    | {infer EscalationAction} kind='manual-intervention';

// -----------------------------------------------------------------------------
// Parameters & Arguments
// -----------------------------------------------------------------------------

ParamList:
    params+=ParamDecl (',' params+=ParamDecl)*;

ParamDecl:
    name=Ident ':' type=FieldType;

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
// -----------------------------------------------------------------------------

Expression:
    OrExpr;

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

// Regex pattern for 'matches': accepts STRING ("regex") or raw bracket syntax [a-zA-Z0-9-]+
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
    | SomeExpr
    | NoFieldContainsExpr
    | IsDefinedExpr
    | IsNotDefinedExpr
    | IsNullExpr
    | IsNotNullExpr
    | InExpr
    | NotInExpr
    | FunctionCallExpr
    | DurationLiteral
    | DotPathOrCallExpr
    | Literal
    | ParenExpr;

// Parse DotPath first, then optionally upgrade to service call (DotPath '(') or plain path.
// Note: value constructors (TypeName { field = value }) are NOT handled here to avoid
// ambiguity with { } blocks in if/every expressions. They are handled in AssignmentClause.
DotPathOrCallExpr infers Expression:
    {infer DotPathExpr} path=DotPath (
        {infer ExprServiceCall.path=current} '(' args=ArgList? ')'
    )?;

IfExpr:
    'if' condition=Expression '{' body=Expression '}';

EveryExpr:
    'every' type=TypeName 'in' collection=DotPath '{' body=Expression '}';

SomeExpr:
    'some' variable=Ident 'in' collection=DotPath '{' body=Expression '}';

NoFieldContainsExpr:
    'no' 'field' 'contains' target=DotPath;

IsDefinedExpr:
    path=DotPath 'is' 'defined';

IsNotDefinedExpr:
    path=DotPath 'is' 'not' 'defined';

IsNullExpr:
    path=DotPath 'is' 'null';

IsNotNullExpr:
    path=DotPath 'is' 'not' 'null';

InExpr:
    path=DotPath 'in' '{' values=ValueList '}';

NotInExpr:
    path=DotPath 'not' 'in' '{' values=ValueList '}';

FunctionCallExpr:
    name=FunctionName '(' args=ArgList? ')';

FunctionName returns string:
    'count' | 'sum' | 'now' | 'today' | 'size' | 'isEmpty' | 'isNotEmpty' | 'append';

ParenExpr:
    '(' expr=Expression ')';

// -----------------------------------------------------------------------------
// Dot-path
// -----------------------------------------------------------------------------

DotPath:
    segments+=PathSegment ('.' segments+=PathSegment)*;

PathSegment:
    value=(ID | KeywordAsIdent | TypeName | STRING)
    index=ArrayIndex?;

ArrayIndex:
    '[' expr=Expression ']';

// -----------------------------------------------------------------------------
// Value expressions
// -----------------------------------------------------------------------------

// Service calls are already produced by Expression (via DotPathOrCallExpr ->
// ExprServiceCall), so a standalone ServiceCallExpr alternative here is redundant
// and was ambiguous with Expression — both start with a DotPath, which is an
// unresolvable LL conflict that made the Chevrotain parser hang on array-literal
// elements such as `[someField]`. Letting Expression handle it removes the conflict.
ValueExpr:
    ArrayLiteral | Expression;

// NOTE: Value constructors (TypeName { field = value, ... }) cannot be parsed
// by an LL parser in expression position due to ambiguity with { } blocks.
// The tree-sitter GLR parser handles these. This is a known limitation.

ArrayLiteral:
    '[' first=ValueExpr (',' more+=ValueExpr)* ']';

ValueList:
    values+=ValueExpr (',' values+=ValueExpr)*;

// -----------------------------------------------------------------------------
// Duration literal
// -----------------------------------------------------------------------------

DurationLiteral:
    amount=NUMBER unit=DurationUnit;

DurationUnit returns string:
    'months' | 'days' | 'years' | 'hours' | 'minutes' | 'seconds' | 'weeks';

// -----------------------------------------------------------------------------
// Literals
// -----------------------------------------------------------------------------

LiteralValue:
    StringLiteral | NumberLiteral | BooleanLiteral;

Literal infers Expression:
    {infer StringLiteralExpr} value=STRING
    | {infer NumberLiteralExpr} value=NUMBER
    | {infer BooleanLiteralExpr} value=('true' | 'false')
    // `null` is a keyword (used by `is null` / `is not null`); as a literal it
    // keeps comparisons like `field != null` parsing as a value, not an identifier.
    | {infer NullLiteralExpr} value='null';

StringLiteral:
    value=STRING;

NumberLiteral:
    value=NUMBER;

BooleanLiteral:
    value=('true' | 'false');

// -----------------------------------------------------------------------------
// Helper rules for identifiers
// -----------------------------------------------------------------------------

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

terminal REQUIREMENT_ID: /REQ-[A-Z][A-Z0-9]*-\d{3}/;
terminal CARDINALITY: /\d+\.\.\d+|\d+\.\.N/;
terminal TYPE_NAME: /[A-Z][a-zA-Z0-9]*/;
terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
terminal STRING: /"[^"]*"/;
terminal NUMBER: /-?\d+(\.\d+)?/;
// REGEX matches bracket expressions like [a-zA-Z0-9-]+.
// Restricted to require at least one lowercase letter or range (a-z),
// to avoid consuming [REQ-XXX-NNN] (all uppercase) as a regex.
terminal REGEX: /\[[^\]]*[a-z][^\]]*\][*+?]?/;
