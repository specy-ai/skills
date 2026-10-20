# Specy Tree-sitter Parsers

Four tree-sitter parsers provide syntax highlighting (and future LSP support) for the Specy DSL files.

| Parser | Language name | File type | Location |
|--------|---------------|-----------|----------|
| `specy_prd` | `specy_prd` | `.prd` | `src/tree-sitters/tree-sitter-specy-prd/` |
| `specy_sysreq` | `specy_sysreq` | `.sysreq` | `src/tree-sitters/tree-sitter-specy-sysreq/` |
| `specy_domain` | `specy_domain` | `.domain` | `src/tree-sitters/tree-sitter-specy-domain/` |
| `specy_architecture` | `specy_architecture` | `.arch` | `src/tree-sitters/tree-sitter-specy-architecture/` |

`specy_domain` handles both module-level (v2, e.g. `business-loan.domain`) and full-hierarchy formats with organizations, bounded contexts, nested modules, state machines, reactions, agreements, and reconciliation (e.g. `url-shortener.domain`).

`specy_architecture` handles both roots of a `.arch` file: `architecture` (C4 levels 1–3, e.g. `url-shortener.arch`) and `organization` (level 0, the system landscape, e.g. `retail-media.arch`).


## Prerequisites

- **tree-sitter CLI** (v0.22+), to build the parsers:

  ```sh
  brew install tree-sitter    # or: cargo install --locked tree-sitter-cli
  ```

- **Neovim** 0.10+ (uses built-in `vim.treesitter`, no nvim-treesitter plugin required). The system Vim (`/usr/bin/vim` on macOS) cannot load tree-sitter parsers.


## Build all parsers

From the project root:

```sh
./src/tree-sitters/build.sh     # or: ./build.sh tree-sitters
```

This generates the C parser (`tree-sitter generate`) and compiles the shared library (`tree-sitter build`) for each grammar, then runs smoke tests (parse + highlights query) against the example files.

To build a single parser manually:

```sh
cd src/tree-sitters/tree-sitter-specy-domain
tree-sitter generate
tree-sitter build
# produces specy-domain.dylib (macOS) or specy-domain.so (Linux)
```


## Neovim setup

From the project root, once the parsers are built:

```sh
./src/tree-sitters/sync-nvim.sh
```

The script writes `~/.config/nvim/plugin/specy-tree-sitter.lua`, generated from every parser in `src/tree-sitters/`: it maps each file extension listed in the parser's `tree-sitter.json` to a filetype, registers the compiled library, puts the parser directory on the runtimepath (for its queries) and starts tree-sitter highlighting for those filetypes. It then opens each file type in a headless Neovim, with your config, and reports whether it is highlighted.

- **Re-run it** after adding, renaming or moving a parser: the file is regenerated from scratch.
- **No re-run needed** after rebuilding a parser or editing `highlights.scm`: the file points at the libraries and queries in this checkout. Restart Neovim to pick them up.
- **Another config:** `NVIM_APPNAME=<name> ./src/tree-sitters/sync-nvim.sh` (it follows `NVIM_APPNAME` and `XDG_CONFIG_HOME`, like Neovim).
- **Uninstall:** delete `~/.config/nvim/plugin/specy-tree-sitter.lua`.
- It removes the `-- [specy-tree-sitter]` block that the former `install-nvim.sh` appended to `init.lua`, backing `init.lua` up first (`init.lua.bak-<timestamp>`).

### Query file layout

Neovim looks for highlight queries at `queries/<lang>/highlights.scm` within any runtimepath entry. Each parser keeps its source file at `queries/highlights.scm` and a committed symlink at the Neovim location:

```
tree-sitter-specy-domain/
  queries/
    highlights.scm            <-- source file
    specy_domain/
      highlights.scm          <-- symlink to ../highlights.scm
```

`sync-nvim.sh` creates the symlink when a parser lacks it; commit it with the parser.


## Verifying the setup

1. Open a `.domain` file in neovim.
2. Run `:InspectTree` to see the parse tree.
3. Run `:Inspect` on any token to see which highlight group is applied.
4. If no highlighting appears, check:
   - `:echo &filetype` shows the correct filetype (e.g. `specy_domain`)
   - `:lua print(vim.treesitter.get_parser():lang())` returns the language name
   - The `.dylib`/`.so` file exists in the parser directory


## Highlight groups

All parsers use standard neovim tree-sitter capture names:

| Capture | Applied to |
|---------|-----------|
| `@keyword.type` | `entity`, `value`, `enum`, `command`, `event`, `service`, `product`, `persona`, `feature` |
| `@keyword` | Structural keywords (`fields`, `operations`, `priority`, `status`, etc.) |
| `@keyword.operator` | `on`, `when`, `then`, `creates`, `sets`, `emits`, `resolves`, `from` |
| `@keyword.control` | `if`, `every`, `and`, `or`, `not` |
| `@type.definition` | Names at definition site (`entity Order`, `command PlaceOrder`) |
| `@type` | PascalCase identifiers in type-reference positions |
| `@type.builtin` | `string`, `int`, `decimal`, `boolean`, `date`, `datetime`, `uuid`, `list`, `set` |
| `@variable.member` | Field names |
| `@variable.parameter` | Parameter names |
| `@function` | Policy, invariant, and operation names |
| `@function.builtin` | `count`, `sum`, `now`, `today`, `size`, `isEmpty`, `isNotEmpty` |
| `@function.call` | Service/entity call targets |
| `@attribute` | Constraint keywords (`required`, `optional`, `unique`, `immutable`, etc.) |
| `@label` | Requirement IDs (`REQ-ORD-001`) |
| `@constant` | Enum values, context map patterns, MoSCoW priorities, EARS patterns |
| `@string` | String literals |
| `@string.special` | Descriptions (`:: "text"`), operation labels, requirement names |
| `@number` | Numbers and cardinalities |
| `@boolean` | `true`, `false` |
| `@operator` | `::`, `-->`, `->`, `=`, `!=`, `>`, `<`, `>=`, `<=`, `+`, `-`, `*`, `/` |
| `@comment` | `//` comments (domain) and `#` comments (PRD, sysreq) |
| `@punctuation.bracket` | `{`, `}`, `(`, `)`, `<`, `>`, `[`, `]` |
| `@punctuation.delimiter` | `,`, `:` |


## Project structure

```
specy-skill/
  build.sh                                     <-- builds every component, the parsers included
  TREE-SITTER.md                               <-- this file
  src/
    grammars/                                  <-- canonical EBNF grammars (prd, sysreq, domain, architecture)
    tree-sitters/
      build.sh                                 <-- builds the four parsers, runs the smoke tests
      sync-nvim.sh                             <-- registers them in Neovim
      tree-sitter-specy-prd/
        grammar.js
        tree-sitter.json                       <-- language name and file types
        queries/highlights.scm
      tree-sitter-specy-sysreq/
      tree-sitter-specy-domain/
      tree-sitter-specy-architecture/
```
