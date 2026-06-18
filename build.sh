#!/usr/bin/env bash
# =============================================================================
# Root build orchestrator for Specy.
#
# Builds every component of the repo by delegating to the per-component build
# scripts, then prints a one-line-per-component summary:
#
#   skills        src/skills/build.sh        — assemble dist/ (the `specy` plugin)   [pure bash]
#   tree-sitters  src/tree-sitters/build.sh  — generate+build parsers, smoke-test    [needs tree-sitter CLI]
#   langium       src/langium/specy-domain/build.sh — generate+compile, validate     [needs node + npm]
#
# Components whose required external tooling is missing are SKIPPED with a
# warning (not a failure), so a fresh checkout with only bash still builds the
# skills. A component that runs but errors makes this script exit non-zero.
#
# Usage:
#   ./build.sh                         # build everything available
#   ./build.sh skills                  # build only the named component(s)
#   ./build.sh skills tree-sitters     # build a subset
#   ./build.sh -h | --help
# =============================================================================

set -uo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; BOLD='\033[1m'; RESET='\033[0m'

ALL_COMPONENTS=(skills tree-sitters langium)

usage() {
  cat <<EOF
Specy build orchestrator.

Usage: ./build.sh [component...]

Components (default: all):
  skills         Assemble dist/ (the \`specy\` plugin) from src/skills/ templates.   [pure bash]
  tree-sitters   Generate + build the tree-sitter parsers and run smoke tests.       [needs tree-sitter CLI]
  langium        Generate + compile the Langium parser and validate examples.        [needs node + npm]

Behavior:
  - A component whose required tool is missing is skipped with a warning.
  - A component that runs but fails makes this script exit non-zero.
EOF
}

# have <cmd...> — true only if every named command is on PATH
have() { for c in "$@"; do command -v "$c" >/dev/null 2>&1 || return 1; done; return 0; }

# Per-component results, filled in by run_*; keys map to "OK" | "FAIL" | "SKIP".
declare -A STATUS
declare -A REASON

run_skills() {
  printf "${BOLD}==> skills${RESET}\n"
  if "$ROOT/src/skills/build.sh"; then
    STATUS[skills]=OK
  else
    STATUS[skills]=FAIL
  fi
}

run_tree-sitters() {
  printf "${BOLD}==> tree-sitters${RESET}\n"
  if ! have tree-sitter; then
    STATUS[tree-sitters]=SKIP
    REASON[tree-sitters]="tree-sitter CLI not on PATH"
    printf "${YELLOW}    skipped: %s${RESET}\n" "${REASON[tree-sitters]}"
    return
  fi
  if "$ROOT/src/tree-sitters/build.sh"; then
    STATUS[tree-sitters]=OK
  else
    STATUS[tree-sitters]=FAIL
  fi
}

run_langium() {
  printf "${BOLD}==> langium${RESET}\n"
  if ! have node npm; then
    STATUS[langium]=SKIP
    REASON[langium]="node and/or npm not on PATH"
    printf "${YELLOW}    skipped: %s${RESET}\n" "${REASON[langium]}"
    return
  fi
  if "$ROOT/src/langium/specy-domain/build.sh"; then
    STATUS[langium]=OK
  else
    STATUS[langium]=FAIL
  fi
}

# --- parse args -------------------------------------------------------------
components=()
for arg in "$@"; do
  case "$arg" in
    -h|--help) usage; exit 0 ;;
    skills|tree-sitters|langium) components+=("$arg") ;;
    *) printf "${RED}Unknown component: %s${RESET}\n\n" "$arg" >&2; usage >&2; exit 2 ;;
  esac
done
[[ ${#components[@]} -eq 0 ]] && components=("${ALL_COMPONENTS[@]}")

# --- run --------------------------------------------------------------------
printf "${BOLD}Building Specy → %s${RESET}\n\n" "$ROOT"
for c in "${components[@]}"; do
  "run_$c"
  echo ""
done

# --- summary ----------------------------------------------------------------
printf "${BOLD}Summary${RESET}\n"
fail=0
for c in "${components[@]}"; do
  case "${STATUS[$c]:-FAIL}" in
    OK)   printf "  ${GREEN}%-14s OK${RESET}\n" "$c" ;;
    SKIP) printf "  ${YELLOW}%-14s SKIPPED${RESET} (%s)\n" "$c" "${REASON[$c]:-}" ;;
    *)    printf "  ${RED}%-14s FAILED${RESET}\n" "$c"; fail=1 ;;
  esac
done

exit "$fail"
