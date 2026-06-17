#!/usr/bin/env bash
# =============================================================================
# Build script for Specy skills
#
# Assembles SKILL.md files from src/skills/ templates by resolving include markers:
#   <!-- include: path -->           → inlines file content as-is
#   <!-- include-code: lang path --> → wraps content in a fenced code block
#
# Also copies conditional runtime files (heuristics, grammars) to dist/.
#
# Usage: ./src/skills/build.sh [skill...]
#   With no arguments, builds all skills.
#   With arguments, builds only the named skills (e.g. distill dialogue).
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DIST_DIR="$REPO_ROOT/dist"

HEADER="<!-- GENERATED FILE — DO NOT EDIT. Source: src/skills/%s/main.md — Run src/skills/build.sh to regenerate. -->"

# -----------------------------------------------------------------------------
# resolve_includes: reads a template and replaces include markers
# $1 = template file path
# $2 = base directory for resolving relative paths
# -----------------------------------------------------------------------------
resolve_includes() {
  local template="$1"
  local basedir="$2"

  while IFS= read -r line; do
    # <!-- include: path -->
    if [[ "$line" =~ ^'<!-- include: '(.+)' -->'$ ]]; then
      local path="${BASH_REMATCH[1]}"
      local resolved="$basedir/$path"
      if [[ ! -f "$resolved" ]]; then
        # Try from src/skills/ root
        resolved="$SCRIPT_DIR/$path"
      fi
      if [[ -f "$resolved" ]]; then
        cat "$resolved"
      else
        echo "ERROR: include not found: $path (from $template)" >&2
        exit 1
      fi

    # <!-- include-code: lang path -->
    elif [[ "$line" =~ ^'<!-- include-code: '([^ ]+)' '(.+)' -->'$ ]]; then
      local lang="${BASH_REMATCH[1]}"
      local path="${BASH_REMATCH[2]}"
      local resolved="$basedir/$path"
      if [[ ! -f "$resolved" ]]; then
        resolved="$SCRIPT_DIR/$path"
      fi
      if [[ -f "$resolved" ]]; then
        echo '```'"$lang"
        cat "$resolved"
        echo '```'
      else
        echo "ERROR: include-code not found: $path (from $template)" >&2
        exit 1
      fi

    else
      echo "$line"
    fi
  done < "$template"
}

# -----------------------------------------------------------------------------
# build_skill: builds one SKILL.md from its main.md template
# $1 = skill name (distill, dialogue, spec, prd, sysreq, domain)
# -----------------------------------------------------------------------------
build_skill() {
  local skill="$1"
  local src_dir="$SCRIPT_DIR/$skill"
  local out_dir="$DIST_DIR/skills/$skill"
  local template="$src_dir/main.md"
  local output="$out_dir/SKILL.md"

  if [[ ! -f "$template" ]]; then
    echo "SKIP: $template not found" >&2
    return
  fi

  mkdir -p "$out_dir"

  {
    resolve_includes "$template" "$src_dir" | grep -v '^<!-- TEMPLATE' | sed '/./,$!d'
  } > "$output"

  local lines
  lines=$(wc -l < "$output" | tr -d ' ')
  echo "  $skill/SKILL.md: $lines lines"
}

# -----------------------------------------------------------------------------
# copy_runtime_files: copies files needed at runtime (conditional loading)
# These are files the agent reads on demand during execution, not embedded in SKILL.md.
# -----------------------------------------------------------------------------
copy_runtime_files() {
  local SKILLS_OUT="$DIST_DIR/skills"

  # domain-extract-from-code: stack-specific heuristics + domain grammar
  local dxc_heuristics="$SKILLS_OUT/domain-extract-from-code/heuristics"
  mkdir -p "$dxc_heuristics"
  for f in java-spring.md typescript-nestjs.md clojure.md; do
    cp "$SCRIPT_DIR/domain-extract-from-code/heuristics/$f" "$dxc_heuristics/$f"
  done
  local dxc_grammars="$SKILLS_OUT/domain-extract-from-code/grammars"
  mkdir -p "$dxc_grammars"
  cp "$REPO_ROOT/src/grammars/domain.ebnf" "$dxc_grammars/domain.ebnf"
  echo "  domain-extract-from-code/: 3 heuristics + 1 grammar copied"

  # domain-build-code: stack-specific heuristics + domain grammar + metamodel
  local dbc_heuristics="$SKILLS_OUT/domain-build-code/heuristics"
  mkdir -p "$dbc_heuristics"
  for f in java-spring.md typescript-nestjs.md clojure.md; do
    cp "$SCRIPT_DIR/domain-build-code/heuristics/$f" "$dbc_heuristics/$f"
  done
  local dbc_grammar="$SKILLS_OUT/domain-build-code/grammar"
  local dbc_refs="$SKILLS_OUT/domain-build-code/references"
  mkdir -p "$dbc_grammar" "$dbc_refs"
  cp "$REPO_ROOT/src/grammars/domain.ebnf" "$dbc_grammar/domain.ebnf"
  cp "$REPO_ROOT/src/metamodels/DOMAIN-METAMODEL.md" "$dbc_refs/DOMAIN-METAMODEL.md"
  echo "  domain-build-code/: 3 heuristics + 1 grammar + 1 reference copied"

  # domain-refactor: domain grammar + metamodel (emits a redesigned .domain)
  local dr_grammar="$SKILLS_OUT/domain-refactor/grammar"
  local dr_refs="$SKILLS_OUT/domain-refactor/references"
  mkdir -p "$dr_grammar" "$dr_refs"
  cp "$REPO_ROOT/src/grammars/domain.ebnf" "$dr_grammar/domain.ebnf"
  cp "$REPO_ROOT/src/metamodels/DOMAIN-METAMODEL.md" "$dr_refs/DOMAIN-METAMODEL.md"
  echo "  domain-refactor/: 1 grammar + 1 reference copied"

  # sysreq-extract-from-code: sysreq grammar + metamodel reference
  local sxc_refs="$SKILLS_OUT/sysreq-extract-from-code/references"
  local sxc_grammar="$SKILLS_OUT/sysreq-extract-from-code/grammar"
  mkdir -p "$sxc_refs" "$sxc_grammar"
  cp "$REPO_ROOT/src/metamodels/SYSTEM-REQ-METAMODEL.md" "$sxc_refs/SYSTEM-REQ-METAMODEL.md"
  cp "$REPO_ROOT/src/grammars/sysreq.ebnf" "$sxc_grammar/sysreq.ebnf"
  echo "  sysreq-extract-from-code/: 1 reference + 1 grammar copied"

  # prd-design: grammar + references
  local prd_grammar="$SKILLS_OUT/prd-design/grammar"
  local prd_refs="$SKILLS_OUT/prd-design/references"
  mkdir -p "$prd_grammar" "$prd_refs"
  cp "$REPO_ROOT/src/grammars/prd.ebnf" "$prd_grammar/prd.ebnf"
  cp "$REPO_ROOT/src/metamodels/PRODUCT-REQ-METAMODEL.md" "$prd_refs/PRODUCT-REQ-METAMODEL.md"
  echo "  prd-design/: 1 grammar + 1 reference copied"

  # sysreq-design: grammar + references
  local sysreq_grammar="$SKILLS_OUT/sysreq-design/grammar"
  local sysreq_refs="$SKILLS_OUT/sysreq-design/references"
  mkdir -p "$sysreq_grammar" "$sysreq_refs"
  cp "$REPO_ROOT/src/grammars/sysreq.ebnf" "$sysreq_grammar/sysreq.ebnf"
  cp "$REPO_ROOT/src/metamodels/SYSTEM-REQ-METAMODEL.md" "$sysreq_refs/SYSTEM-REQ-METAMODEL.md"
  cp "$REPO_ROOT/src/metamodels/PRODUCT-REQ-METAMODEL.md" "$sysreq_refs/PRODUCT-REQ-METAMODEL.md"
  echo "  sysreq-design/: 1 grammar + 2 references copied"

  # domain-design: grammar + references
  local domain_grammar="$SKILLS_OUT/domain-design/grammar"
  local domain_refs="$SKILLS_OUT/domain-design/references"
  mkdir -p "$domain_grammar" "$domain_refs"
  cp "$REPO_ROOT/src/grammars/domain.ebnf" "$domain_grammar/domain.ebnf"
  cp "$REPO_ROOT/src/metamodels/DOMAIN-METAMODEL.md" "$domain_refs/DOMAIN-METAMODEL.md"
  cp "$REPO_ROOT/src/metamodels/SYSTEM-REQ-METAMODEL.md" "$domain_refs/SYSTEM-REQ-METAMODEL.md"
  cp "$REPO_ROOT/src/metamodels/PRODUCT-REQ-METAMODEL.md" "$domain_refs/PRODUCT-REQ-METAMODEL.md"
  echo "  domain-design/: 1 grammar + 3 references copied"
}

# -----------------------------------------------------------------------------
# copy_plugin_manifest: writes the Claude Code plugin manifest into dist/
# so dist/ is a self-contained `specy` plugin (dist/.claude-plugin/plugin.json).
# -----------------------------------------------------------------------------
copy_plugin_manifest() {
  local manifest_dir="$DIST_DIR/.claude-plugin"
  mkdir -p "$manifest_dir"
  cp "$SCRIPT_DIR/plugin/plugin.json" "$manifest_dir/plugin.json"
  echo "  .claude-plugin/plugin.json copied"
}

# -----------------------------------------------------------------------------
# main
# -----------------------------------------------------------------------------
echo "Building skills → $DIST_DIR"

if [[ $# -gt 0 ]]; then
  for skill in "$@"; do
    build_skill "$skill"
  done
else
  # Core skills (artefact-oriented names; invoked as specy:<name>)
  build_skill prd-design
  build_skill sysreq-design
  build_skill sysreq-extract-from-code
  build_skill domain-design
  build_skill domain-build-code
  build_skill domain-extract-from-code
  build_skill domain-refactor
  # Auxiliary skills
  build_skill domain-dialogue
fi

copy_runtime_files
copy_plugin_manifest

echo "Done."
