// =============================================================================
// Specy Synthetic-Data Scenario Grammar (.synth)
//
// Mirrors src/grammars/synth.ebnf — the normative grammar derived from
// src/metamodels/SYNTH-METAMODEL.md. Keep the three in sync.
//
// A scenario says what generated data must ADD UP TO for one .domain model: how
// many rows, which revenue curve, which lifecycle mix, which payment split. It
// never restates the domain. Every domain element it names is a cross-reference
// into the .domain it declares with `domain-source`, resolved against that file's
// AST by SpecySynthScopeProvider — so an unknown entity, field, state or enum
// member is red in the editor, before any row exists.
//
// The grammar imports the domain grammar for two reasons: the reference types
// (EntityDef, FieldDecl, StateDef, ...) and the shared rules (Description,
// SatisfiesDecl, terminals). It calls none of the domain's parser rules except
// those two, so the domain's keywords stay ordinary identifiers in a .synth file.
//
// The JSON this parses to (specy-synth parse) is the interchange format the
// synthy engine consumes; the engine never sees .synth text.
// =============================================================================

grammar SpecySynth

import "./specy-domain";

// -----------------------------------------------------------------------------
// Top-level: one scenario per file.
// -----------------------------------------------------------------------------

entry SynthFile:
    scenario=ScenarioDef;

// Header clauses come in a fixed order, like the slots of a domain definition:
// satisfies first (the convention of every Specy body), then provenance, then
// the three knobs of the whole run — seed, horizon, observation instant.
ScenarioDef:
    'scenario' name=ScenarioName
    description=Description?
    '{'
        satisfies=SatisfiesDecl?
        domainSource=DomainSourceDecl
        requirementsSource=RequirementsSourceDecl?
        seed=SeedDecl?
        horizon=HorizonDecl?
        asOf=AsOfDecl?
        populations=PopulationsBlock
        outcomes=OutcomesBlock?
        givens=GivensBlock?
        vocabulary=VocabularyBlock?
        distributions=DistributionsBlock?
        options=OptionsBlock?
    '}';

ScenarioName returns string:
    ID | TYPE_NAME;

// The .domain this scenario is written against, relative to the .synth file.
// One model per scenario: synthy generates one model at a time.
DomainSourceDecl:
    'domain-source' path=STRING;

// Same seed, same files: same bytes.
SeedDecl:
    'seed' (number=NUMBER | text=STRING);

// Clocks fall in [from, to). Dates are written bare (2025-01-01) or quoted.
HorizonDecl:
    'horizon' from=DateLiteral '..' to=DateLiteral;

// The instant the snapshot tables are observed at. Defaults to the horizon's end.
AsOfDecl:
    'as-of' instant=InstantLiteral;

DateLiteral returns string:
    DATE | STRING;

InstantLiteral returns string:
    DATE_TIME | DATE | STRING;

// -----------------------------------------------------------------------------
// Populations — how many rows of each row source.
//
//   Customer   count 200                — a fixed number of rows
//   OrderLine  per Order 1..5           — k rows per parent row, k drawn in [1, 5]
//   Payment    per Order exactly 1
//   Customer   count 300 since 2023-01-01   — clocks from that date, not the horizon's start
//
// `clock` names the date/datetime field that places a row in time; it is
// inferred from the start transition of the state machine when omitted.
// -----------------------------------------------------------------------------

PopulationsBlock:
    'populations' '{' (populations+=PopulationDecl)* '}';

PopulationDecl:
    entity=[DomainRef:TypeName]
    (   'count' count=NUMBER ('since' since=DateLiteral)?
      | 'per' parent=[DomainRef:TypeName] ('exactly' exactly=NUMBER | range=CARDINALITY)
    )
    ('clock' clock=[DomainRef:SynthIdent])?
    description=Description?;

// -----------------------------------------------------------------------------
// Outcomes — what the data must add up to. Six kinds, each a hard fact the
// certificate verifies. An outcome may carry a camelCase name (for the
// certificate) and `satisfies` ids (traceability to the requirement that
// states the business figure).
// -----------------------------------------------------------------------------

OutcomesBlock:
    'outcomes' '{' (outcomes+=OutcomeDecl)* '}';

OutcomeDecl:
    CurveOutcome | TotalOutcome | ShareOutcome | MixOutcome | RateOutcome | RollupOutcome;

OutcomeName returns string:
    ID;

// SUM(measure) per period of `by` equals the declared value, exactly, in cents.
// Row counts per period follow the values proportionally unless `over n rows`
// pins them. `alpha` is the Dirichlet concentration of the split: lower, more skewed.
CurveOutcome:
    'curve' name=OutcomeName? measure=SynthPath 'by' by=SynthPath 'per' period=SynthPeriod
    ('alpha' alpha=NUMBER)?
    description=Description?
    '{'
        satisfies=SatisfiesDecl?
        (points+=CurvePoint)*
    '}';

CurvePoint:
    key=PeriodKey ':' value=NUMBER ('over' rows=NUMBER 'rows')? ','?;

// SUM(measure) over the whole population equals the declared value.
TotalOutcome:
    'total' name=OutcomeName? measure=SynthPath '=' value=NUMBER
    ('alpha' alpha=NUMBER)?
    description=Description?
    satisfies=SatisfiesDecl?;

// Fraction of rows per member of an enum field, or per truth value of a boolean
// field. Counts are made exact; the fractions must sum to 1. With `given`, one
// split per value of another column of the same rows — the state, or a column
// another share sets:
//
//   share Payment.method given Payment.status {
//       captured: { creditCard: 70%, paypal: 30% }
//       refunded: { bankTransfer: 100% }
//   }
ShareOutcome:
    'share' name=OutcomeName? dimension=SynthPath ('given' given=SynthPath)?
    description=Description?
    '{'
        satisfies=SatisfiesDecl?
        (shares+=ShareEntry | groups+=ShareGroup)*
    '}';

ShareEntry:
    (member=[EnumValue:SynthIdent] | literal=BooleanKw) ':' value=Fraction ','?;

ShareGroup:
    (member=[EnumValue:SynthIdent] | literal=BooleanKw) ':' '{' (shares+=ShareEntry)* '}' ','?;

// Fraction of rows whose state-machine walk ends in each state. `Entity` means
// the entity's first machine; `Entity.Machine` names one.
MixOutcome:
    'mix' name=OutcomeName? machine=SynthPath
    description=Description?
    '{'
        satisfies=SatisfiesDecl?
        (states+=MixEntry)*
    '}';

MixEntry:
    state=[StateDef:SynthIdent] ':' value=Fraction ','?;

// Fraction of rows satisfying a predicate over enum and boolean columns of one
// entity — `Entity.booleanField`, `Entity.booleanField = false`, `Entity.enumField = member`,
// `!=` — combined with `and`, `or`, `not` and parentheses, over the population or per
// period. A column the state machine drives may be read, never set: the rate splits
// the other columns.
RateOutcome:
    'rate' name=OutcomeName? predicate=RateExpr
    (   ':' value=Fraction description=Description? satisfies=SatisfiesDecl?
      | 'by' by=SynthPath 'per' period=SynthPeriod description=Description?
        '{'
            satisfies=SatisfiesDecl?
            (points+=RatePoint)*
        '}'
    );

RateExpr:
    RateOr;

RateOr infers RateExpr:
    RateAnd ({infer RateBinary.left=current} op='or' right=RateAnd)*;

RateAnd infers RateExpr:
    RateUnary ({infer RateBinary.left=current} op='and' right=RateUnary)*;

RateUnary infers RateExpr:
    {infer RateNot} 'not' operand=RateUnary | RatePrimary;

RatePrimary infers RateExpr:
    '(' RateOr ')' | RatePredicate;

RatePredicate:
    path=SynthPath (op=('=' | '!=') (member=[EnumValue:SynthIdent] | literal=BooleanKw))?;

RatePoint:
    key=PeriodKey ':' value=Fraction ','?;

// A parent measure equals the sum of a child measure over the child's rows.
RollupOutcome:
    'rollup' name=OutcomeName? total=SynthPath 'from' parts=SynthPath
    description=Description?
    satisfies=SatisfiesDecl?;

// -----------------------------------------------------------------------------
// Givens — reference data supplied rather than generated: catalogues, master
// data, the instances of an `enum X of ValueType`. Rows inline, or a CSV/JSON
// file next to the scenario. The block after the source says where a path takes
// its values when the file spells it otherwise; columns the file does not supply
// are generated (an identity, a clock, a default):
//
//   Product csv "catalogue.csv" {
//       name          from "title"
//       price.amount  from "price_eur"
//   }
// -----------------------------------------------------------------------------

GivensBlock:
    'givens' '{' (givens+=GivenDecl)* '}';

GivenDecl:
    entity=[GivenTarget:TypeName]
    (   'csv' csv=STRING
      | 'json' json=STRING
      | 'rows' '[' (rows+=RowLiteral (','? rows+=RowLiteral)*)? ']'
    )
    description=Description?
    ('{' (columns+=GivenColumn)* '}')?;

// A path within the given's entity (or the enum's value type), and the file column it reads.
GivenColumn:
    steps+=SynthPathStep ('.' steps+=SynthPathStep)* 'from' source=STRING ','?;

// What a given may supply: rows of a row source, or the instances of an enum of a value type.
type GivenTarget = EntityDef | AggregateDef | ReadOnlyEntityDef | ValueDef | EnumDef;

RowLiteral:
    '{' (entries+=RowEntry (','? entries+=RowEntry)*)? '}';

RowEntry:
    key=RowKey ':' value=RowValue;

RowKey returns string:
    SynthIdent | STRING;

RowValue:
      {infer RowString} value=STRING
    | {infer RowNumber} value=NUMBER
    | {infer RowBoolean} value=BooleanKw
    | {infer RowNull} value='null'
    | RowLiteral
    | RowArray;

RowArray:
    '[' (items+=RowValue (','? items+=RowValue)*)? ']';

// -----------------------------------------------------------------------------
// Vocabulary — where text columns take their words: a locale pack (built-in, or a
// pack file that may extend one) and word lists for single text fields. Swapping
// packs changes text columns only; numbers, dates, enums stay byte-identical.
//
//   vocabulary {
//       locale fr                                       intl (default), en, fr, de, es, it, nl, "en-GB", ...
//       pack "vocab/fr-ch.json"                         a pack file
//       Product.name words "vocab/wines.txt"            one value per line, or a JSON list
//       Customer.segment words [ "retail", "pro" ]
//   }
// -----------------------------------------------------------------------------

VocabularyBlock:
    'vocabulary' '{'
        ('locale' locale=LocaleName)?
        ('pack' pack=STRING)?
        (words+=WordListDecl)*
    '}';

LocaleName returns string:
    ID | STRING;

WordListDecl:
    field=SynthPath 'words' (file=STRING | '[' (values+=STRING (','? values+=STRING)*)? ']')
    description=Description?;

// -----------------------------------------------------------------------------
// Distributions — how one field's values spread: advisory, never a fact. An
// outcome that fixes a column's sum keeps it; the shape only decides the split.
//
//   distributions {
//       Product.price.amount  lognormal median 25 sigma 0.9
//       OrderLine.quantity    zipf 1.6              a bounded int, an enum, a word list
//       Order.customer        zipf 0.8              a reference: the regulars order more
//       Customer.createdAt    uniform
//   }
// -----------------------------------------------------------------------------

DistributionsBlock:
    'distributions' '{' (distributions+=DistributionDecl)* '}';

DistributionDecl:
    field=SynthPath
    (   shape='uniform'
      | shape='lognormal' ('median' median=NUMBER)? ('sigma' sigma=NUMBER)?
      | shape='zipf' exponent=NUMBER?
    )
    description=Description?;

// -----------------------------------------------------------------------------
// Options — knobs of the generator, never facts about the data.
//
//   alpha 2                      default Dirichlet concentration for exact splits
//   decimals 2                   money-like measures are split in units of 10^-decimals
//   null-rate 20%                probability an optional field nothing decides is left null
//   default-dwell 1d             mean dwell per transition when `dwell` says nothing
//   dwell { draft --> confirmed : 4h }   mean dwell per transition, same arrow as the machine
//   reaction-latency 1min        longest delay between an event and the command a reaction issues
//   rejections 3                 commands per precondition that must be refused (negative fixtures)
// -----------------------------------------------------------------------------

OptionsBlock:
    'options' '{' (entries+=OptionEntry)* '}';

OptionEntry:
    AlphaOption | DecimalsOption | NullRateOption | DefaultDwellOption | DwellBlock | ReactionLatencyOption | RejectionsOption;

AlphaOption:       'alpha' value=NUMBER;
DecimalsOption:    'decimals' value=NUMBER;
NullRateOption:    'null-rate' value=Fraction;
DefaultDwellOption:'default-dwell' value=DurationText;
ReactionLatencyOption: 'reaction-latency' value=DurationText;
RejectionsOption:  'rejections' value=NUMBER;

DwellBlock:
    'dwell' '{' (entries+=DwellEntry)* '}';

DwellEntry:
    from=SynthIdent '-->' to=SynthIdent ':' duration=DurationText ','?;

// 4h, 2d, 45min, 30s, 500ms, 1w — or any string synthy's duration parser reads ("PT2H", "3 days").
DurationText returns string:
    DURATION | STRING;

// -----------------------------------------------------------------------------
// Dot-paths into the domain
//
// The root is a row source (entity, aggregate, read-only entity or value type).
// Each step is a member of what the previous segment resolved to: the identity,
// a field, a reference, a state machine; through a value-typed field, the value
// type's fields. The scope provider computes each step's candidates from the
// previous one, so the editor completes `Order.totalAmount.` with `amount` and
// `currency`.
// -----------------------------------------------------------------------------

SynthPath:
    root=[DomainRef:TypeName] ('.' steps+=SynthPathStep)*;

SynthPathStep:
    target=[DomainRef:SynthIdent];

// What a path segment may resolve to. Enum members and states are referenced
// from share, rate and mix entries, with their own scopes.
type DomainRef = EntityDef | AggregateDef | ReadOnlyEntityDef | ValueDef | IdentityDecl | FieldDecl | ReferenceDecl | StateMachineDef;

// -----------------------------------------------------------------------------
// Literals and identifiers
// -----------------------------------------------------------------------------

SynthPeriod returns string:
    'day' | 'week' | 'month' | 'quarter' | 'year';

// 2025-01 (month) · 2025-01-15 (day) · 2025-Q1 · 2025-W03 · 2025 (year)
PeriodKey returns string:
    PERIOD_KEY | DATE | NUMBER;

// 0.72 or 72% — the same number.
Fraction:
    value=NUMBER percent?='%'?;

BooleanKw returns string:
    'true' | 'false';

// Keywords of this grammar that may also name a field, state or enum member.
// `satisfies`, `true`, `false` and `null` are deliberately absent.
SynthKeywordAsIdent returns string:
    'count' | 'per' | 'by' | 'rows' | 'over' | 'csv' | 'json' | 'alpha' | 'decimals' | 'dwell'
    | 'clock' | 'seed' | 'horizon' | 'scenario' | 'populations' | 'outcomes' | 'givens' | 'options'
    | 'curve' | 'total' | 'share' | 'mix' | 'rate' | 'rollup' | 'exactly' | 'from'
    | 'day' | 'week' | 'month' | 'quarter' | 'year' | 'given' | 'rejections'
    | 'vocabulary' | 'locale' | 'pack' | 'words' | 'distributions' | 'uniform' | 'lognormal' | 'median' | 'sigma' | 'zipf'
    | 'since';

SynthIdent returns string:
    ID | TYPE_NAME | SynthKeywordAsIdent;

// -----------------------------------------------------------------------------
// Terminals — declared here so they are tried before the domain's NUMBER
// (langium-cli appends imported rules after the importing grammar's own, and the
// lexer takes the first match).
// -----------------------------------------------------------------------------

terminal DATE_TIME: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?/;
terminal PERIOD_KEY: /\d{4}-(W\d{2}|Q[1-4])(?!\w)/;
terminal DATE: /\d{4}-\d{2}(-\d{2})?(?!\d)/;
terminal DURATION: /\d+(\.\d+)?(ms|min|s|h|d|w)(?!\w)/;
