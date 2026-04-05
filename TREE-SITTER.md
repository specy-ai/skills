# Specy Tree-sitter Parsers

Three tree-sitter parsers provide syntax highlighting (and future LSP support) for the Specy DSL files.

| Parser | Language name | File types | Location |
|--------|-------------|------------|----------|
| `specy_prd` | `specy_prd` | `.prd`, `.prd` | `skills/prd/tree-sitter-specy-prd/` |
| `specy_sysreq` | `specy_sysreq` | `.sysreq`, `.sysreq.md` | `skills/sysreq/tree-sitter-specy-sysreq/` |
| `specy_domain` | `specy_domain` | `.domain` | `skills/domain/tree-sitter-specy-domain/` |

`specy_domain` handles both module-level (v2, e.g. `business-loan.domain`) and full-hierarchy formats with organizations, bounded contexts, nested modules, state machines, reactions, agreements, and reconciliation (e.g. `url-shortener.domain`).


## Prerequisites

- **tree-sitter CLI** (v0.22+):

  ```sh
  cargo install --locked tree-sitter-cli
  ```

- **Neovim** 0.10+ (uses built-in `vim.treesitter`, no nvim-treesitter plugin required)


## Build all parsers

From the project root:

```sh
./build-tree-sitter.sh
```

This generates the C parser (`tree-sitter generate`) and compiles the shared library (`tree-sitter build`) for each grammar, then runs smoke tests against the example files.

To build a single parser manually:

```sh
cd skills/domain/tree-sitter-specy-domain
tree-sitter generate
tree-sitter build
# produces specy_domain.dylib (macOS) or specy_domain.so (Linux)
```


## Neovim setup

Add the following to your `init.lua`. Adjust `SPECY_ROOT` to point to where you cloned this repository.

```lua
-- ===========================================================================
-- Specy tree-sitter integration
-- ===========================================================================

local SPECY_ROOT = vim.fn.expand('~/path/to/specy-skill')
local parser_ext = vim.fn.has('mac') == 1 and 'dylib' or 'so'

-- Parsers to register
-- `lib` is the dylib/so filename produced by `tree-sitter build` (uses hyphens)
-- `lang` is the grammar name used by neovim (uses underscores)
local parsers = {
  {
    lang = 'specy_domain',
    lib  = 'specy-domain',
    dir  = SPECY_ROOT .. '/skills/domain/tree-sitter-specy-domain',
    patterns = { ['.*%.domain'] = 'specy_domain' },
  },
  {
    lang = 'specy_prd',
    lib  = 'specy-prd',
    dir  = SPECY_ROOT .. '/skills/prd/tree-sitter-specy-prd',
    patterns = { ['.*%.prd'] = 'specy_prd' },
  },
  {
    lang = 'specy_sysreq',
    lib  = 'specy-sysreq',
    dir  = SPECY_ROOT .. '/skills/sysreq/tree-sitter-specy-sysreq',
    patterns = { ['.*%.sysreq%.md'] = 'specy_sysreq', ['.*%.sysreq'] = 'specy_sysreq' },
  },
}

for _, p in ipairs(parsers) do
  -- 1. Register filetypes
  vim.filetype.add({ pattern = p.patterns })

  -- 2. Register the compiled parser (.dylib uses hyphens, lang uses underscores)
  vim.treesitter.language.add(p.lang, {
    path = p.dir .. '/' .. p.lib .. '.' .. parser_ext,
  })

  -- 3. Add to runtimepath so neovim finds queries/<lang>/highlights.scm
  vim.opt.runtimepath:append(p.dir)
end

-- 4. Start tree-sitter highlighting for all Specy filetypes
vim.api.nvim_create_autocmd('FileType', {
  pattern = { 'specy_domain', 'specy_prd', 'specy_sysreq' },
  callback = function()
    vim.treesitter.start()
  end,
})
```

### Query file layout

Neovim looks for highlight queries at `queries/<lang>/highlights.scm` within any runtimepath entry. The build script creates symlinks so the layout is correct:

```
tree-sitter-specy-domain/
  queries/
    highlights.scm            <-- source file
    specy_domain/
      highlights.scm          <-- symlink to ../highlights.scm
```

If the symlink is missing, create it:

```sh
cd skills/domain/tree-sitter-specy-domain/queries
mkdir -p specy_domain
ln -sf ../highlights.scm specy_domain/highlights.scm
```

Repeat for each parser (`specy_prd`, `specy_sysreq`).


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
  build-tree-sitter.sh                          <-- builds all four parsers
  TREE-SITTER.md                                <-- this file
  src/
    tree-sitter-specy/                          <-- v2 compact format
      grammar.js
      queries/highlights.scm
  skills/
    prd/
      grammar/prd.ebnf                          <-- EBNF specification
      tree-sitter-specy-prd/                    <-- tree-sitter parser
        grammar.js
        queries/highlights.scm
    sysreq/
      grammar/sysreq.ebnf
      tree-sitter-specy-sysreq/
        grammar.js
        queries/highlights.scm
    domain/
      grammar/domain.ebnf
      tree-sitter-specy-domain/
        grammar.js
        queries/highlights.scm
```
