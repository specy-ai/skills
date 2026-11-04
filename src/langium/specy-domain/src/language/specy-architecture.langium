// =============================================================================
// Specy Software Architecture Grammar (.arch)
//
// Mirrors src/grammars/architecture.ebnf and
// src/tree-sitters/tree-sitter-specy-architecture — the normative grammars
// derived from src/metamodels/SOFTWARE-ARCHITECTURE-METAMODEL.md. Keep them in
// sync.
//
// Imports the domain grammar for the shared terminals (STRING, TYPE_NAME, ID,
// NUMBER, REQUIREMENT_ID, the hidden comments) and the two shared rules whose
// keywords are the same in every Specy language (Description, SatisfiesDecl).
// The metadata block is declared here, not imported: the domain's MetadataEntry
// reaches KeywordAsIdent and would reserve every domain keyword in a .arch file.
// None of the domain's other parser rules is called, so its keywords stay
// ordinary words here. Rule names carry the `Arch` prefix: the five grammars
// generate one AST module.
//
// Keywords are reserved everywhere by the lexer, and this language has many
// contextual words (`area`, `to`, `over`, `channel`, `context`, `region`, …).
// Every position that takes a camelCase identifier goes through ArchIdent,
// which admits each lowercase keyword back as a name; every position that takes
// a type name goes through ArchTypeName, which admits the context-map pattern
// names (`ACL`, `CS`, …) back as type names.
// =============================================================================

grammar SpecyArchitecture

import "./specy-domain";

// -----------------------------------------------------------------------------
// Top-level: two alternative roots. One root per file is a validation rule.
// -----------------------------------------------------------------------------

entry ArchFile:
    (roots+=ArchRoot)*;

ArchRoot:
    ArchArchitectureDef | ArchOrganizationDef;

// -----------------------------------------------------------------------------
// architecture — ONE software system in focus (C4 levels 1 to 3)
// -----------------------------------------------------------------------------

ArchArchitectureDef:
    'architecture' name=ArchSystemName
    description=Description?
    metadata=ArchMetadataBlock?
    '{'
        (members+=ArchArchitectureMember)*
    '}';

ArchArchitectureMember:
    ArchDomainSourceDecl | ArchRequirementsSourceDecl | ArchPersonDef | ArchExternalSystemDef | ArchSystemDef;

ArchSystemName returns string:
    ArchTypeName | STRING;

// Provenance — may be repeated: one .domain file per bounded context.
ArchDomainSourceDecl:
    'domain-source' path=STRING;

ArchRequirementsSourceDecl:
    'requirements-source' path=STRING;

// -----------------------------------------------------------------------------
// organization — level 0: the system landscape
// -----------------------------------------------------------------------------

ArchOrganizationDef:
    'organization' name=ArchTypeName
    description=Description?
    metadata=ArchMetadataBlock?
    '{'
        (members+=ArchOrganizationMember)*
    '}';

ArchOrganizationMember:
    ArchDomainSourceDecl | ArchRequirementsSourceDecl | ArchPhaseDef | ArchAreaDef | ArchPersonDef
    | ArchOrgExternalSystemDef | ArchOrgSystemDef | ArchDependencyDef;

// A stage of the integration roadmap. Declaration order is chronological order.
ArchPhaseDef:
    'phase' name=ArchTypeName
    description=Description?
    metadata=ArchMetadataBlock?;

// A grouping of systems as the business sees its landscape.
ArchAreaDef:
    'area' name=ArchTypeName
    description=Description?
    metadata=ArchMetadataBlock?;

// External system of an organization: externalSystemDef plus the concepts it masters.
ArchOrgExternalSystemDef:
    'externalSystem' name=ArchTypeName
    description=Description?
    metadata=ArchMetadataBlock?
    realizes=ArchRealizesDecl?
    ('{'
        (clauses+=ArchOrgExternalSystemClause)*
    '}')?;

ArchOrgExternalSystemClause:
    ArchProvidesClause | ArchConsumesClause | ArchMastersClause;

// System of an organization — described from the outside. Without a body it is
// a black box. The level-0 clauses come first; the members after them detail
// the system inline (levels 2 to 3).
ArchOrgSystemDef:
    'system' name=ArchTypeName
    description=Description?
    metadata=ArchMetadataBlock?
    technology=ArchTechnologyDecl?
    satisfies=SatisfiesDecl?
    realizes=ArchRealizesDecl?
    ('{'
        (level0+=ArchLevel0Clause)*
        (members+=ArchSystemMember)*
    '}')?;

ArchLevel0Clause:
    ArchAreaRef | ArchUsedByClause | ArchMastersClause | ArchHandlesClause | ArchHotspotDef | ArchDetailedInDecl;

ArchAreaRef:
    'area' name=ArchTypeName;

// The persons who work with the system.
ArchUsedByClause:
    'used-by' persons+=ArchTypeName (',' persons+=ArchTypeName)*;

// masters: the concepts the system is the system of record for.
ArchMastersClause:
    'masters' concepts+=ArchConceptRef (',' concepts+=ArchConceptRef)*;

// handles: the other main concepts it holds.
ArchHandlesClause:
    'handles' concepts+=ArchConceptRef (',' concepts+=ArchConceptRef)*;

// Path of a single-system .arch file whose system in focus has the same name.
ArchDetailedInDecl:
    'detailed-in' path=STRING;

// A known point of fragility or effort. The description is required.
ArchHotspotDef:
    'hotspot' name=ArchTypeName
    description=Description
    metadata=ArchMetadataBlock?
    ('concerns' concerns+=ArchConcernRef (',' concerns+=ArchConcernRef)*)?;

ArchConcernRef:
    ArchFlowConcern | ArchConceptRef;

ArchFlowConcern:
    number=NUMBER;

// Concept reference — a domain type name, optionally qualified by its bounded
// context: Invoice | Finance.Invoice.
ArchConceptRef:
    (context=ArchTypeName '.')? name=ArchTypeName;

// -----------------------------------------------------------------------------
// Dependency — `A -> B` reads "A depends on B": A is downstream, B upstream.
// -----------------------------------------------------------------------------

ArchDependencyDef:
    'dependency' downstream=ArchTypeName '->' upstream=ArchTypeName
    (':' patterns+=ArchDependencyPattern (',' patterns+=ArchDependencyPattern)*)?
    ('criticality' criticality=ArchCriticality)?
    description=Description?
    metadata=ArchMetadataBlock?
    ('{'
        (flows+=ArchFlowDef)*
    '}')?;

// Each pattern belongs to one side; which may be combined is a validation rule.
ArchDependencyPattern returns string:
    'CS' | 'Conformist' | 'ACL' | 'OHS' | 'SharedKernel' | 'PublishedLanguage' | 'Partnership';

ArchCriticality returns string:
    'critical' | 'degraded' | 'tolerant';

// -----------------------------------------------------------------------------
// Flow — one numbered, named movement of domain concepts along a dependency.
// -----------------------------------------------------------------------------

ArchFlowDef:
    'flow' number=NUMBER label=STRING
    description=Description?
    metadata=ArchMetadataBlock?
    'carries' carries+=ArchCarriedConcept (',' carries+=ArchCarriedConcept)*
    ('to' to=ArchTypeName)?
    (mechanism=ArchMechanism | '{' (phases+=ArchPhasedMechanism)+ '}')?;

// `X as Y`: X in the sender's model becomes Y in the receiver's.
ArchCarriedConcept:
    concept=ArchConceptRef ('as' becomes=ArchConceptRef)?;

// The medium (`over`) and whether a person performs the transfer. At least one.
ArchMechanism:
    {infer ArchMechanism} 'over' medium=STRING mode=ArchTransferMode?
    | {infer ArchMechanism} mode=ArchTransferMode;

ArchTransferMode returns string:
    'manual' | 'automated';

ArchPhasedMechanism:
    'phase' phase=ArchTypeName mechanism=ArchMechanism;

// -----------------------------------------------------------------------------
// Level 1 — System Context: persons and external systems
// -----------------------------------------------------------------------------

ArchPersonDef:
    'person' name=ArchTypeName
    description=Description?
    metadata=ArchMetadataBlock?;

ArchExternalSystemDef:
    'externalSystem' name=ArchTypeName
    description=Description?
    metadata=ArchMetadataBlock?
    realizes=ArchRealizesDecl?
    ('{'
        (clauses+=ArchExternalSystemClause)*
    '}')?;

ArchExternalSystemClause:
    ArchProvidesClause | ArchConsumesClause;

// -----------------------------------------------------------------------------
// System — the one software system in focus of an `architecture` file
// -----------------------------------------------------------------------------

ArchSystemDef:
    'system' name=ArchSystemName
    description=Description?
    metadata=ArchMetadataBlock?
    satisfies=SatisfiesDecl?
    realizes=ArchRealizesDecl?
    '{'
        (members+=ArchSystemMember)*
    '}';

ArchSystemMember:
    ArchNamedTypeDef | ArchInterfaceDef | ArchBoundedContextDecl | ArchContainerDef
    | ArchChannelDef | ArchConnectorDef | ArchEnvironmentDef;

// Optional grouping over components (declared, then referenced by a component).
ArchBoundedContextDecl:
    'boundedContext' name=ArchTypeName
    description=Description?
    metadata=ArchMetadataBlock?;

// -----------------------------------------------------------------------------
// Level 2 — Container: a runnable/deployable unit
// -----------------------------------------------------------------------------

ArchContainerDef:
    'container' name=ArchTypeName
    description=Description?
    metadata=ArchMetadataBlock?
    technology=ArchTechnologyDecl?
    satisfies=SatisfiesDecl?
    realizes=ArchRealizesDecl?
    ('{'
        (clauses+=ArchContainerClause)*
    '}')?;

ArchContainerClause:
    ArchProvidesClause | ArchRequiresClause | ArchComponentDef;

ArchTechnologyDecl:
    'technology' value=STRING;

// -----------------------------------------------------------------------------
// Level 3 — Component: finest logical unit
// -----------------------------------------------------------------------------

ArchComponentDef:
    'component' name=ArchTypeName
    description=Description?
    metadata=ArchMetadataBlock?
    satisfies=SatisfiesDecl?
    realizes=ArchRealizesDecl?
    ('{'
        (clauses+=ArchComponentClause)*
    '}')?;

ArchComponentClause:
    ArchBoundedContextRef | ArchProvidesClause | ArchRequiresClause | ArchPublishesClause | ArchSubscribesClause;

ArchBoundedContextRef:
    'boundedContext' name=ArchTypeName;

// -----------------------------------------------------------------------------
// Ports and channel participation
// -----------------------------------------------------------------------------

ArchProvidesClause:
    'provides' interface=ArchTypeName;

ArchRequiresClause:
    'requires' interface=ArchTypeName;

ArchConsumesClause:
    'consumes' interface=ArchTypeName;

ArchPublishesClause:
    'publishes' message=ArchTypeName 'to' channel=ArchIdent;

ArchSubscribesClause:
    'subscribes' channel=ArchIdent;

// -----------------------------------------------------------------------------
// Interface — first-class named contract (a set of operations)
// -----------------------------------------------------------------------------

ArchInterfaceDef:
    'interface' name=ArchTypeName
    description=Description?
    metadata=ArchMetadataBlock?
    satisfies=SatisfiesDecl?
    realizes=ArchRealizesDecl?
    '{'
        (operations+=ArchOperationDef)*
    '}';

// (default) request-response, unsafe | safe | oneway (returns void) | streaming
ArchOperationDef:
    style=ArchOperationStyle?
    name=ArchIdent '(' (args+=ArchArgDecl (',' args+=ArchArgDecl)*)? ')'
    'returns' (void?='void' | returnType=ArchFieldType)
    ('throws' '(' throws+=ArchTypeName (',' throws+=ArchTypeName)* ')')?
    description=Description?
    metadata=ArchMetadataBlock?;

ArchOperationStyle returns string:
    'safe' | 'oneway' | 'streaming';

// Thrift-style: ordinal, requiredness, type, name, optional default
ArchArgDecl:
    ordinal=NUMBER ':' requiredness=ArchRequiredness type=ArchFieldType name=ArchIdent ('=' default=ArchLiteral)?;

ArchRequiredness returns string:
    'required' | 'optional';

// -----------------------------------------------------------------------------
// Named types — Thrift-inspired type system + domain imports
// -----------------------------------------------------------------------------

ArchNamedTypeDef:
    ArchStructDef | ArchEnumDef | ArchTypedefDef | ArchUnionDef | ArchExceptionDef | ArchImportDecl;

ArchStructDef:
    'struct' name=ArchTypeName
    description=Description?
    metadata=ArchMetadataBlock?
    satisfies=SatisfiesDecl?
    '{'
        (fields+=ArchFieldDef)+
    '}';

ArchExceptionDef:
    'exception' name=ArchTypeName
    description=Description?
    metadata=ArchMetadataBlock?
    '{'
        (fields+=ArchFieldDef)+
    '}';

ArchFieldDef:
    ordinal=NUMBER ':' requiredness=ArchRequiredness type=ArchFieldType name=ArchIdent ('=' default=ArchLiteral)?
    description=Description?;

ArchUnionDef:
    'union' name=ArchTypeName
    description=Description?
    metadata=ArchMetadataBlock?
    '{'
        (members+=ArchUnionMember)+
    '}';

ArchUnionMember:
    ordinal=NUMBER ':' type=ArchFieldType name=ArchIdent;

ArchEnumDef:
    'enum' name=ArchTypeName
    description=Description?
    metadata=ArchMetadataBlock?
    '{'
        (members+=ArchEnumMember)+
    '}';

ArchEnumMember:
    name=ArchIdent '=' value=NUMBER;

ArchTypedefDef:
    'typedef' name=ArchTypeName '=' type=ArchFieldType;

// `import value type X from domain` | `import event X from domain`
ArchImportDecl:
    'import' (valueType?='value' 'type' | event?='event') name=ArchTypeName 'from' 'domain';

// -----------------------------------------------------------------------------
// Channel — first-class async topic/queue hosted on a broker container
// -----------------------------------------------------------------------------

ArchChannelDef:
    'channel' name=ArchIdent 'on' broker=ArchTypeName
    description=Description?
    metadata=ArchMetadataBlock?
    '{'
        'carries' carries+=ArchTypeName (',' carries+=ArchTypeName)*
    '}';

// -----------------------------------------------------------------------------
// Connector — wires a consumer (or required port) to a provider (or provided port)
// -----------------------------------------------------------------------------

ArchConnectorDef:
    'connect' from=ArchConnectorRef '->' to=ArchConnectorRef
    'over' protocol=STRING style=ArchConnectorStyle
    description=Description?
    metadata=ArchMetadataBlock?;

// WebApp | LinkController.LinkCommands | CampaignHub.CampaignApi.DeliveryQueries
ArchConnectorRef:
    segments+=ArchTypeName ('.' segments+=ArchTypeName)*;

ArchConnectorStyle returns string:
    'sync' | 'async' | 'streaming';

// -----------------------------------------------------------------------------
// Deployment view — environments, nodes, resources
// -----------------------------------------------------------------------------

ArchEnvironmentDef:
    'environment' name=ArchIdent
    description=Description?
    metadata=ArchMetadataBlock?
    '{'
        (members+=ArchEnvironmentMember)*
    '}';

ArchEnvironmentMember:
    ArchDeployClause | ArchNodeDef;

ArchDeployClause:
    'deploy' containers+=ArchTypeName (',' containers+=ArchTypeName)* ('replicas' replicas=NUMBER)?;

// Nodes nest. Each attribute at most once, in any order (a validation rule).
ArchNodeDef:
    'node' name=ArchIdent
    description=Description?
    metadata=ArchMetadataBlock?
    (attributes+=ArchNodeAttribute)*
    '{'
        (members+=ArchNodeMember)*
    '}';

ArchNodeAttribute:
    {infer ArchNodeAttribute} kind='provider' value=STRING
    | {infer ArchNodeAttribute} kind='region' value=STRING
    | {infer ArchNodeAttribute} kind='zone' value=STRING;

ArchNodeMember:
    ArchNodeDef | ArchDeployClause | ArchResourceDef;

// A provisioned unit of infrastructure: where data physically lives.
ArchResourceDef:
    'resource' name=ArchIdent
    description=Description?
    metadata=ArchMetadataBlock?
    ('instantiates' instantiates=ArchTypeName)?
    technology=ArchTechnologyDecl?
    ('tenancy' tenancy=ArchTenancy)?
    ('{'
        'stores' stores+=ArchTypeName (',' stores+=ArchTypeName)*
    '}')?;

ArchTenancy returns string:
    'shared' | 'dedicated';

// -----------------------------------------------------------------------------
// Realizes — traceability link to domain elements
// -----------------------------------------------------------------------------

ArchRealizesDecl:
    'realizes' refs+=ArchRealizesRef (',' refs+=ArchRealizesRef)*;

ArchRealizesRef:
    {infer ArchRealizesRef} kind='module' name=ArchDomainName
    | {infer ArchRealizesRef} kind='context' name=ArchDomainName
    | {infer ArchRealizesRef} kind='interface' name=ArchTypeName
    | {infer ArchRealizesRef} kind='event' name=ArchTypeName
    | {infer ArchRealizesRef} kind='value' 'type' name=ArchTypeName;

// A string literal is accepted for readability; prefer the bare name.
ArchDomainName returns string:
    ArchTypeName | STRING;

// -----------------------------------------------------------------------------
// Field types — lowercase primitives + containers + named types
// -----------------------------------------------------------------------------

ArchFieldType:
    ArchPrimitiveType | ArchCollectionType | {infer ArchNamedType} typeName=ArchTypeName;

ArchPrimitiveType:
    value=ArchPrimitiveTypeKw;

ArchPrimitiveTypeKw returns string:
    'string' | 'int' | 'integer' | 'long' | 'double' | 'decimal' | 'boolean'
    | 'date' | 'datetime' | 'time' | 'instant' | 'duration' | 'uuid' | 'binary';

ArchCollectionType:
    kind=ArchCollectionKind '<' elementType=ArchFieldType (',' valueType=ArchFieldType)? '>';

ArchCollectionKind returns string:
    'list' | 'set' | 'map';

// -----------------------------------------------------------------------------
// Metadata and literals
// -----------------------------------------------------------------------------

ArchMetadataBlock:
    'meta' '{' (entries+=ArchMetadataEntry)* '}';

ArchMetadataEntry:
    key=ArchIdent '=' value=ArchLiteral;

ArchLiteral:
    {infer ArchStringLiteral} value=STRING
    | {infer ArchNumberLiteral} value=NUMBER
    | {infer ArchBooleanLiteral} value=('true' | 'false')
    | {infer ArchNullLiteral} value='null';

// -----------------------------------------------------------------------------
// Identifiers — keywords admitted back as names
// -----------------------------------------------------------------------------

ArchTypeName returns string:
    TYPE_NAME | 'CS' | 'Conformist' | 'ACL' | 'OHS' | 'SharedKernel' | 'PublishedLanguage' | 'Partnership';

ArchIdent returns string:
    ID | ArchKeywordAsIdent;

ArchKeywordAsIdent returns string:
    'architecture' | 'organization' | 'phase' | 'area' | 'person' | 'externalSystem' | 'system'
    | 'dependency' | 'masters' | 'handles' | 'hotspot' | 'concerns' | 'criticality'
    | 'critical' | 'degraded' | 'tolerant' | 'flow' | 'carries' | 'as' | 'to' | 'over'
    | 'manual' | 'automated' | 'boundedContext' | 'container' | 'technology' | 'component'
    | 'provides' | 'requires' | 'consumes' | 'publishes' | 'subscribes' | 'interface'
    | 'safe' | 'oneway' | 'streaming' | 'returns' | 'void' | 'throws' | 'required' | 'optional'
    | 'struct' | 'exception' | 'union' | 'enum' | 'typedef' | 'import' | 'value' | 'type'
    | 'event' | 'from' | 'domain' | 'channel' | 'on' | 'connect' | 'sync' | 'async'
    | 'environment' | 'deploy' | 'replicas' | 'node' | 'provider' | 'region' | 'zone'
    | 'resource' | 'instantiates' | 'tenancy' | 'shared' | 'dedicated' | 'stores'
    | 'realizes' | 'module' | 'context' | 'satisfies' | 'meta'
    | 'string' | 'int' | 'integer' | 'long' | 'double' | 'decimal' | 'boolean'
    | 'date' | 'datetime' | 'time' | 'instant' | 'duration' | 'uuid' | 'binary'
    | 'list' | 'set' | 'map' | 'true' | 'false' | 'null';
