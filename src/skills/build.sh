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
# $1 = skill name (distill-v3, dialogue, spec, prd, sysreq, domain)
# -----------------------------------------------------------------------------
build_skill() {
  local skill="$1"
  local src_dir="$SCRIPT_DIR/$skill"
  local out_dir="$DIST_DIR/$skill"
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
  # distill-v3: stack-specific heuristics
  local distill_v3_heuristics="$DIST_DIR/distill-v3/heuristics"
  mkdir -p "$distill_v3_heuristics"
  for f in java-spring.md typescript-nestjs.md clojure.md; do
    cp "$SCRIPT_DIR/distill-v3/heuristics/$f" "$distill_v3_heuristics/$f"
  done
  echo "  distill-v3/heuristics/: 3 files copied"

  # distill-v3: domain grammar
  local distill_v3_grammars="$DIST_DIR/distill-v3/grammars"
  mkdir -p "$distill_v3_grammars"
  cp "$REPO_ROOT/src/grammars/domain.ebnf" "$distill_v3_grammars/domain.ebnf"
  echo "  distill-v3/grammars/: 1 file copied"

  # spec: v3 domain grammar (runtime reference for changes blocks)
  local spec_grammars="$DIST_DIR/spec/grammars"
  mkdir -p "$spec_grammars"
  cp "$REPO_ROOT/src/grammars/domain.ebnf" "$spec_grammars/domain.ebnf"
  echo "  spec/grammars/: 1 file copied"

  # prd: grammar + references
  local prd_grammar="$DIST_DIR/prd/grammar"
  local prd_refs="$DIST_DIR/prd/references"
  mkdir -p "$prd_grammar" "$prd_refs"
  cp "$REPO_ROOT/src/grammars/prd.ebnf" "$prd_grammar/prd.ebnf"
  cp "$REPO_ROOT/src/metamodels/PRODUCT-REQ-METAMODEL.md" "$prd_refs/PRODUCT-REQ-METAMODEL.md"
  echo "  prd/grammar/: 1 file, prd/references/: 1 file copied"

  # sysreq: grammar + references
  local sysreq_grammar="$DIST_DIR/sysreq/grammar"
  local sysreq_refs="$DIST_DIR/sysreq/references"
  mkdir -p "$sysreq_grammar" "$sysreq_refs"
  cp "$REPO_ROOT/src/grammars/sysreq.ebnf" "$sysreq_grammar/sysreq.ebnf"
  cp "$REPO_ROOT/src/metamodels/SYSTEM-REQ-METAMODEL.md" "$sysreq_refs/SYSTEM-REQ-METAMODEL.md"
  cp "$REPO_ROOT/src/metamodels/PRODUCT-REQ-METAMODEL.md" "$sysreq_refs/PRODUCT-REQ-METAMODEL.md"
  echo "  sysreq/grammar/: 1 file, sysreq/references/: 2 files copied"

  # domain: grammar + references
  local domain_grammar="$DIST_DIR/domain/grammar"
  local domain_refs="$DIST_DIR/domain/references"
  mkdir -p "$domain_grammar" "$domain_refs"
  cp "$REPO_ROOT/src/grammars/domain.ebnf" "$domain_grammar/domain.ebnf"
  cp "$REPO_ROOT/src/metamodels/DOMAIN-METAMODEL.md" "$domain_refs/DOMAIN-METAMODEL.md"
  cp "$REPO_ROOT/src/metamodels/SYSTEM-REQ-METAMODEL.md" "$domain_refs/SYSTEM-REQ-METAMODEL.md"
  cp "$REPO_ROOT/src/metamodels/PRODUCT-REQ-METAMODEL.md" "$domain_refs/PRODUCT-REQ-METAMODEL.md"
  echo "  domain/grammar/: 1 file, domain/references/: 3 files copied"
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
  build_skill dialogue
  build_skill spec
  build_skill distill-v3
  build_skill prd
  build_skill sysreq
  build_skill domain
fi

copy_runtime_files

echo "Done."
