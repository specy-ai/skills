---
name: model-formats
version: v1
description: "Input — a Specy model in any encoding: a `.domain`, `.prd`, `.sysreq`, `.arch` or `.synth` file, its JSON or YAML document, or a Markdown document written by a person or a language model (loosely, or by the Specy Markdown conventions). Output — the same model in the encoding asked for (DSL, JSON, YAML or Markdown), validated by the language's parser. Use this skill whenever the user wants to convert, export, import, render, serialize or round-trip a Specy model between formats; wants a model as JSON or YAML for a tool, a pipeline or an LLM, or as Markdown for a document, a wiki or a review; has a Markdown PRD, a requirements list, a domain description, an architecture note or a data-scenario note and wants the Specy file out of it; asks to validate a `<name>.<language>.json`, `.yaml` or `.md` file; or mentions `specy convert`, `specy validate`, MODEL-FORMATS, the Markdown conventions, `$schema` or `specy.ai/schemas`. The skill drives the `specy` CLI and never hand-writes a structured output the converter can produce; for the Markdown the converter cannot map, it restructures the Markdown to the conventions (or completes the DSL) and re-runs the converter until nothing is left unmapped. If the Markdown is a brief rather than a model (no personas, no requirements, no entities to speak of), delegate to the design skill of the layer (`prd-design`, `sysreq-design`, `domain-design`, `architecture-design`, `synth-design`) with the Markdown as its prose input."
user-invocable: true
---

# Skill: model-formats

## Role

Every Specy model is **one document with four encodings**: the DSL people write (`.domain`, `.prd`,
`.sysreq`, `.arch`, `.synth`), JSON and YAML for programs and language models, Markdown for people.
You move a model between those encodings with the `specy` CLI, and you handle the one conversion a
program cannot finish alone: Markdown that was written without the conventions.

```
   JSON / YAML ◄──── print ──── model ──── toMarkdown ────► Markdown
        │                        ▲                              │
        │ schema check           │ parse (the one DSL parser)   │ reader (conventions) + YOU
        └──► DSL text ───────────┴──────────────── DSL text ◄───┘
```

Reading any encoding ends in the DSL parser, so whatever the input, the output has passed the
language's grammar, validation rules and cross-references, and the model you hand back is canonical.

---

## Cardinal Rules

1. **The converter writes the structured output, not you.** Never type a JSON, YAML or DSL rendering
   of a model by hand when `specy convert` can produce it: run the command and hand over its output.
   You write by hand only the Markdown you restructure, or the DSL lines that fill a gap the
   converter reported.
2. **Every delivery ends with `specy validate`** on the file you produced, in its final encoding, and
   you report its diagnostics verbatim. A file you have not validated is not delivered.
3. **Read every diagnostic aloud.** `MD-UNMAPPED` means a part of the user's text is not in the
   model; `MD-DEFAULT-KIND` and the other `MD-*` warnings mean the reader assumed something. Tell the
   user what was dropped or assumed, and where (the line numbers are Markdown lines).
4. **Keep the user's words.** When you restructure Markdown, move sentences into the places the
   conventions give them (a description, a label, a table cell); do not rewrite their meaning, do not
   invent facts to fill a required field — ask, or leave the field for the user with a visible
   `// UNCLEAR:` comment in the DSL.
5. **Name the file for its encoding**: `<name>.<language>`, `<name>.<language>.json`,
   `<name>.<language>.yaml`, `<name>.<language>.md`. The language is then never ambiguous.
6. **Do not edit `dist/` outputs or generated files**; edit the source encoding the user keeps and
   regenerate the others.

---

## Prerequisites — what to load

1. `references/MODEL-FORMATS.md`: the contract — the file names, what round-trips and what is lossy,
   the general Markdown rules (front matter, `kind Name` headings, `**Label:** value` lines, tables,
   lists, `specy` islands) and, per language, the headings, labels, tables and islands the reader
   understands and the writer produces. **Read the general rules and the section of the language at
   hand before touching any Markdown.**
2. `references/schemas/*.schema.json`: the JSON Schemas of the documents (`domain-model`, `prd`,
   `sysreq`, `architecture`, `synth-scenario`). Read one when a user hands you a JSON or YAML document
   to fix, or asks what a field means.

## The CLI

The `specy` CLI ships with the Langium package of the specy-skill repository
(`src/langium/specy-domain/`, binary `specy`). From a checkout, `./specy.sh …` builds it on first use
and forwards the arguments; from the package, `node out/cli/specy.js …`.

```bash
specy convert <file> --to dsl|json|yaml|markdown [-o [file]] [--pretty] [--strict] [--language L] [--from F]
specy validate <file> [--dsl]          # schema (json/yaml), Markdown mapping, grammar, rules, references
specy detect <file>                    # which language and encoding it is read as
specy formats                          # the matrix
```

- `--to markdown -o` writes `<name>.<language>.md` next to the input; `-o <path>` names the file.
- Diagnostics go to stderr as `file:line:col [severity] (stage) message`; the exit code is 1 on an
  error (with `--strict`, nothing is written on an error).
- A `.synth` scenario needs its `.domain` next to it (`domain-source` in the DSL, `domain` in the
  document or the Markdown front matter); the converter reads it from the disk.

---

## Workflows

### A. Export — DSL to JSON, YAML or Markdown

1. `specy validate <file>` first: a model with errors converts best-effort, and the user should know.
2. `specy convert <file> --to <encoding> -o` (JSON: add `--pretty` for a human reader).
3. Say what the encoding keeps and drops (MODEL-FORMATS.md, "What converts losslessly"): comments are
   not in the model; definitions come out grouped by kind; a Markdown export is canonical and reads
   back with no diagnostic.

### B. Import — JSON or YAML to the DSL

1. `specy validate <file.json|yaml>`. Schema errors name a path in the document (`/products/0/features/2
   must have required property 'priority'`); parser errors name a line of the DSL the document was
   printed as (`--dsl` prints it).
2. Fix the **document** (the user's source), not the printed DSL, unless the user wants the DSL from
   now on. Re-run until clean.
3. `specy convert <file> --to dsl -o`, then `specy validate` the result.

### C. Import — Markdown to the DSL (the conversion that needs you)

This is the loop the skill exists for. The converter does the structural work; you do the rest.

1. **Look before converting.** Open the Markdown and the language's section of MODEL-FORMATS.md side
   by side. Is the document a model (personas and features; requirements with EARS statements;
   entities with fields; systems and containers; populations and outcomes) or a brief? A brief goes
   to the design skill of the layer with the Markdown as prose. A model continues here.
2. **Convert once, read everything:**
   `specy convert <file>.md --to dsl --language <language> -o /tmp/<name>.<language> 2> /tmp/<name>.log`
   then read the log. Sort the diagnostics:
   - `MD-UNMAPPED` — a paragraph, list, table or code block the reader could not place. It is also
     kept in the generated DSL as `// unmapped (markdown line N): …`, so nothing is lost yet.
   - `MD-HEADING` — a heading that names no construct; its sub-headings were read in place.
   - `MD-DEFAULT-KIND`, `MD-IDENTITY-TYPE`, `MD-INTERFACE-ROLE`, `MD-ENFORCEMENT`, … — an assumption.
     Check each against the text.
   - `MD-<LABEL>` errors (`MD-READS-FROM`, `MD-TRIGGERED-BY`, …) — a required clause is missing; the
     message names the label to add.
   - parser errors `(DSL line N)` — the generated DSL is not valid; the Markdown line is the one
     reported, the DSL line is given for reading `--dsl` output.
3. **Decide where to fix.** If the user will keep editing the Markdown (a living document), fix the
   **Markdown**: rename headings to `kind Name` (or add a group heading above bare names), turn a
   `Label: value` sentence into a `**Label:** value` line with a label the section lists, put fields
   into the table, move formal fragments (operations, state machines, invariants, Thrift contracts,
   outcome values) into a ```` ```specy ```` island. If the Markdown is a one-off input, fix the
   **generated DSL** instead: replace each `// unmapped …` comment by the clause it meant, or by a
   `// NOTE:` comment when the sentence is context rather than model.
4. **Re-run until the log is clean** (no `MD-*`, no parser error), at most six rounds; then report
   what still resists and why.
5. `specy validate` the final DSL file; deliver it with the list of assumptions you confirmed and the
   sentences you turned into `// NOTE:` comments.

What goes where, when a sentence has no obvious place:

| The sentence is… | Put it… |
|---|---|
| what the element is | its description (the first paragraph under the heading → `:: "…"`) |
| a reason, a justification | a `// NOTE:` comment in the DSL, or the `rationale` where the language has one (`.sysreq`) |
| a rule that can be stated formally | an invariant, a precondition, a requirement — in a `specy` island or as a new construct |
| a fact the grammar cannot express | `// UNCLEAR:` in the DSL, and a line in your report |
| context about the project, not the model | leave it out of the model; say so |

### D. Round trip — proving two encodings are the same model

`specy convert a.domain --to markdown -o /tmp/a.domain.md && specy convert /tmp/a.domain.md --to json
> /tmp/b.json && specy convert a.domain --to json > /tmp/a.json && diff <(jq -S . /tmp/a.json) <(jq -S .
/tmp/b.json)`: an empty diff (the `parser` header aside) is the proof. Use it when a user doubts that a
Markdown or YAML rendering is faithful.

---

## Reporting

End with: the files produced (one per encoding, with their names), the validate verdict of each, the
assumptions the reader made that you confirmed, the unmapped sentences and what became of them, and
the parts of the model that the target encoding does not carry (comments, order), if any.
