# The format layer

One document, four encodings, for the five Specy languages. The user-facing
contract is `src/metamodels/MODEL-FORMATS.md`; this note is for whoever adds or
changes a language's converter.

```
formats/
├── kit/                  shared machinery
│   ├── codec.ts          ModelCodec, Language, Format, Diagnostic, the registry
│   ├── parse.ts          parseText(): in-memory Langium parse on the shared services, with companions
│   ├── detect.ts         language and encoding from a file name or a text
│   ├── schema.ts         Ajv validation of a JSON/YAML document
│   ├── dsl.ts            IndentWriter, quote(), describe(), metaBlock(), literal() — the printers' house style
│   ├── text.ts           collapse(), compact(), canonicalJson()
│   ├── markdown-blocks.ts   the block tokenizer (headings, paragraphs, lists, tables, fences, quotes), with line numbers
│   ├── markdown-reader.ts   sections, kind headings, **Label:** lines, tables, lists, DslBuilder (DSL text + line map + diagnostics)
│   └── markdown-writer.ts   MarkdownWriter: front matter, headings, labels, tables, lists, islands
├── convert.ts            read(): any encoding -> canonical model; write(): model -> any encoding; convert()
├── index.ts              registers the five codecs, exports the API
├── generated/schemas.ts  the JSON Schemas of src/schemas/, embedded by scripts/embed-schemas.mjs
└── <language>/
    ├── codec.ts          the ModelCodec: parse (normalizer), print, toMarkdown, fromMarkdown, schema
    ├── model.ts          normalizer: Langium AST -> clean document (the domain's lives in cli/domain-model.ts)
    ├── printer.ts        document -> DSL text
    └── markdown.ts       document -> Markdown (writer) and Markdown -> DSL text (reader)
```

## Adding or completing a language

1. **Grammar** — `src/language/specy-<lang>.langium`, mirroring the EBNF in
   `src/grammars/` and the tree-sitter grammar (the tree-sitter one is the more
   faithful of the two where they differ: it is smoke-tested on `examples/`).
   Import `./specy-domain` for the shared terminals and the shared rules
   (`Description`, `MetadataBlock`, `SatisfiesDecl`), prefix every rule name
   (`Prd…`, `Req…`, `Arch…`): the five grammars generate one `ast.ts`.
   `npm run langium:generate`, then check every example parses
   (`node out/cli/specy.js validate examples/…`).
2. **Normalizer** — AST to a plain document: `$schema` and `parser` first,
   camelCase keys, DSL keywords kept as strings (`event-driven`, `must`),
   `kind` on the members of a polymorphic list, `collapse()` on every string
   that may span lines, `compact()` so no key holds `undefined`. The document
   must carry everything the printer needs to write the DSL back.
3. **Printer** — document to DSL, in the grammar's order of clauses. Use
   `IndentWriter`, `quote()`, `describe()`, `metaBlock()`; write the bare form
   of a name when the grammar accepts it (`nameOrString`). Export the block
   printers the Markdown writer needs for its islands.
4. **Schema** — `src/schemas/<name>.schema.json`, `$id`
   `https://specy.ai/schemas/<name>/1.json`, strict (`additionalProperties:
   false` wherever the shape is closed), with descriptions on the properties a
   reader would wonder about. `npm run schemas` embeds it.
5. **Markdown writer and reader** — `markdown.ts`, following the general rules
   of MODEL-FORMATS.md: one `KindSpec[]` table drives both the writer's headings
   and the reader's matching; `**Label:**` lines for the simple clauses, tables
   for field-like rows, lists for name lists, `specy` islands for what the DSL
   says better. The reader transpiles to DSL through `DslBuilder`, never builds
   a model, and reports every leftover with `unmapped()`.
6. **Codec** — `codec.ts` assembles the five functions; `index.ts` registers
   it (already done for the five languages: replace the placeholder file).
7. **Tests** — `test/formats.test.ts` round-trips every example file through
   the three other encodings and expects the same model back, with no
   diagnostic on the canonical Markdown. Add a `test/<lang>-markdown.test.ts`
   with a loosely written document (group headings, `- Label:` lists, aliases,
   an unmapped paragraph) and check what the reader makes of it.
8. **Docs** — fill the language's section of MODEL-FORMATS.md (headings,
   labels, tables and islands, an example) and the README's parser section.

## Conventions the code keeps

- A reader never guesses silently: a default taken from context is a warning
  naming what was assumed; a required clause that is missing is an error naming
  the label to add.
- The canonical Markdown round-trips with zero diagnostics; the tests pin it.
- Diagnostics carry `source` (`parser`, `schema`, `markdown`, `printer`) and,
  for Markdown input, the Markdown line.
- The JSON of a language is what its existing consumers already read
  (synthy for `.synth` and `.domain`): additive changes only, with a bump of
  `PARSER_VERSION` and a line in its comment.
