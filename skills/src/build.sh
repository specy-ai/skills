#!/usr/bin/env bash
# =============================================================================
# Build script for Specy skills
#
# Assembles SKILL.md files from src/ templates by resolving include markers:
#   <!-- include: path -->           → inlines file content as-is
#   <!-- include-code: lang path --> → wraps content in a fenced code block
#
# Also copies conditional runtime files (heuristics) to the output directories.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_DIR="$(dirname "$SCRIPT_DIR")"

HEADER="<!-- GENERATED FILE — DO NOT EDIT. Source: src/%s/main.md — Run src/build.sh to regenerate. -->"

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
        # Try from src/ root
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
# $1 = skill name (distill, dialogue, spec)
# -----------------------------------------------------------------------------
build_skill() {
  local skill="$1"
  local src_dir="$SCRIPT_DIR/$skill"
  local out_dir="$SKILLS_DIR/$skill"
  local template="$src_dir/main.md"
  local output="$out_dir/SKILL.md"

  if [[ ! -f "$template" ]]; then
    echo "SKIP: $template not found" >&2
    return
  fi

  mkdir -p "$out_dir"

  # Build the SKILL.md: header + resolved template (skip the template's own header comment)
  {
    printf "$HEADER\n\n" "$skill"
    resolve_includes "$template" "$src_dir" | grep -v '^<!-- TEMPLATE'
  } > "$output"

  local lines
  lines=$(wc -l < "$output" | tr -d ' ')
  echo "  $skill/SKILL.md: $lines lines"
}

# -----------------------------------------------------------------------------
# copy_runtime_files: copies files needed at runtime (conditional loading)
# -----------------------------------------------------------------------------
copy_runtime_files() {
  local distill_heuristics="$SKILLS_DIR/distill/heuristics"
  mkdir -p "$distill_heuristics"

  # Copy stack-specific heuristics (loaded conditionally by the agent)
  for f in java-spring.md typescript-nestjs.md clojure.md; do
    cp "$SCRIPT_DIR/distill/heuristics/$f" "$distill_heuristics/$f"
  done

  echo "  distill/heuristics/: 3 files copied"
}

# -----------------------------------------------------------------------------
# main
# -----------------------------------------------------------------------------
echo "Building skills..."

build_skill distill
build_skill dialogue
build_skill spec
copy_runtime_files

echo "Done."
