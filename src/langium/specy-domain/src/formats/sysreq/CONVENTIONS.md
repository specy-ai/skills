## System requirements (`.sysreq`)

A requirements file is one or more requirement sets, each scoped to a bounded context or an organization; a set holds requirements directly or in modules. The document (`$schema: https://specy.ai/schemas/sysreq/1.json`) is `{ requirementSets: [ { name, scope, prdSources[], requirements[], modules: [ { name, requirements[] } ] } ] }`; a requirement is `{ id, name, pattern, rationale, statement, priority, source, dependsOn[], conflictsWith[], decomposedInto[], satisfiedBy: [ { role, target } ] }`, where `target` is the domain element as the DSL names it (`Order`, `Order.status`, `Order."Place order"`) and `role` is `satisfied-by-infrastructure` when no element carries the obligation. Clauses written on either side of the EARS statement land in the same place; the printer writes them in one order (rationale, source, statement, priority, then the traceability clauses) and loose requirements before modules.

### Headings

| Heading | DSL |
|---|---|
| `# requirements "Link Shortening" scoped-to UrlShortenerContext` | `requirements "Link Shortening" scoped-to UrlShortenerContext { … }` |
| `## module Link Shortening` | `module "Link Shortening" { … }` |
| `### REQ-LNK-001 Short link generation` | `REQ-LNK-001 "Short link generation" : <pattern> …` — the id identifies a requirement, at any level |

Tolerated: `# Requirements: Link Shortening` with a `**Scope:** UrlShortenerContext` line (alias `Scoped to`, `Context`); `### REQ-LNK-001 — Short link generation`, `### REQ-LNK-001: …`, `### requirement REQ-LNK-001 …`; a `## Requirements` group heading whose bare-name children (`### Clipboard copy`) carry their id on an `**Id:**` line; a `## Modules` group heading whose children are modules; a plain heading that holds requirement headings is read as a module (`MD-DEFAULT-KIND`); a heading that holds neither is transparent (`MD-HEADING`). A requirement heading outside any set is an error (`MD-NO-SET`).

### Labels

| Element | Labels (canonical, then aliases) | DSL |
|---|---|---|
| requirement set | `PRD source` (`PRD`, `Product requirements`), one line per file or a comma list; `Scope` when not in the heading; `Name` when the heading is bare | `prd-source "…"`; `scoped-to X` |
| requirement | `Pattern` (`EARS pattern`, `Type`): ubiquitous, state-driven, event-driven, unwanted, optional, complex | `: pattern` on the id line |
| | `Priority` (`MoSCoW`): must, should, could, wont (`won't` accepted) | `priority …` |
| | `Source` (`Traces to`, `PRD element`, `Origin`) | `source "…"` |
| | `Rationale` (`Why`, `Justification`, `Reason`) | `:: "…"` |
| | the EARS statement as a blockquote `> When …, the system shall …`; or `Statement` (`EARS statement`, `Requirement`, `Shall`); a bare paragraph is accepted with `MD-STATEMENT-PARAGRAPH` | `"…"` |
| | `Depends on` (`Dependencies`, `Prerequisites`); `Conflicts with` (`Conflicts`, `In tension with`); `Decomposed into` (`Decomposes into`, `Children`, `Derived`) — comma lists or bullet lists of ids | `depends-on …`; `conflicts-with …`; `decomposed-into { … }` |
| | `Satisfied by` (`Satisfaction`, `Realized by`, `Traceability`) + list of `<role> Element` items: `implemented-by`, `structured-by`, `enforced-by`, `detected-by`, `quality-constrained-by` (also `implemented by`), and `satisfied-by-infrastructure` (also `Infrastructure`) | `satisfied-by { implemented-by Order."Place order" … }` |
| | `Id` (`Identifier`) when the heading carries no id; `Name` (`Title`) when it carries only the id | the id line |

Several labels may share a line: `**Pattern:** event-driven · **Priority:** must`. Labels may be a bullet list (`- Priority: must`). A missing pattern, statement or priority is an error naming the label (`MD-PATTERN`, `MD-STATEMENT`, `MD-PRIORITY`); a value outside the EARS patterns or MoSCoW levels is an error naming the allowed values; a requirement without a name after its id takes the id as its name (`MD-NAME`).

### Tables, lists and islands

- A **table of requirements** is read anywhere in a set or a module when it has an `id` column and a `statement` column (`| id | name | pattern | priority | statement | source |`; optional `rationale`, `depends on`, `conflicts with`, `decomposed into`, `satisfied by` with ` · `-separated entries). One requirement per row, in order, on the row's line for diagnostics. The writer never emits this form; it exists for short lists and for documents that start as a review table.
- `Satisfied by` is a bullet list (one link per item, the element in inline code). `Depends on`, `Conflicts with` and `Decomposed into` are comma lists.
- The language has no formal fragments, so no `specy` island is needed; a fenced code block under a requirement is reported as unmapped.

### Example

```markdown
---
specy: sysreq
---

# requirements "Link Shortening" scoped-to UrlShortenerContext

**PRD source:** url-shortener.prd

## module Link Shortening

### REQ-LNK-001 Short link generation

**Pattern:** event-driven
**Priority:** must
**Source:** AC-001-01
**Rationale:** Core utility — the fundamental action that brings publishers to the product

> When a publisher submits a URL, the system shall generate a unique short link and return it within 1 second.

**Depends on:** REQ-SAF-001
**Satisfied by:**
- implemented-by `ShortLink."Shorten a URL"`
- structured-by `ShortLink.slug`
```

reads as

```
requirements "Link Shortening" scoped-to UrlShortenerContext {
  prd-source "url-shortener.prd"

  module "Link Shortening" {

    REQ-LNK-001 "Short link generation" : event-driven
      :: "Core utility — the fundamental action that brings publishers to the product"
      source "AC-001-01"
      "When a publisher submits a URL, the system shall generate a unique short link and return it within 1 second."
      priority must
      depends-on REQ-SAF-001
      satisfied-by {
        implemented-by ShortLink."Shorten a URL"
        structured-by ShortLink.slug
      }
  }
}
```
