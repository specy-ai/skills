#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

GRAMMARS=(
  "tree-sitter-specy-prd"
  "tree-sitter-specy-sysreq"
  "tree-sitter-specy-domain"
)

EXAMPLES=(
  "examples/business-loan/business-loan.prd"
  "examples/business-loan/business-loan.sysreq"
  "examples/business-loan/business-loan.domain"
  "examples/url-shortener/url-shortener.prd"
  "examples/url-shortener/url-shortener.sysreq"
  "examples/url-shortener/url-shortener.domain"
)

RED='\033[0;31m'
GREEN='\033[0;32m'
BOLD='\033[1m'
RESET='\033[0m'

fail=0

for grammar in "${GRAMMARS[@]}"; do
  dir="$SCRIPT_DIR/$grammar"
  name=$(basename "$grammar")
  printf "${BOLD}%-40s${RESET}" "$name"

  if ! (cd "$dir" && tree-sitter generate 2>&1); then
    printf " ${RED}generate failed${RESET}\n"
    fail=1
    continue
  fi

  if ! (cd "$dir" && tree-sitter build 2>&1); then
    printf " ${RED}build failed${RESET}\n"
    fail=1
    continue
  fi

  printf " ${GREEN}OK${RESET}\n"
done

echo ""
echo "${BOLD}Smoke tests${RESET}"

for example in "${EXAMPLES[@]}"; do
  file="$ROOT/$example"
  base=$(basename "$example")
  printf "  %-50s" "$base"

  # Find the right parser by trying each grammar dir
  parsed=0
  for grammar in "${GRAMMARS[@]}"; do
    dir="$SCRIPT_DIR/$grammar"
    errors=$(cd "$dir" && tree-sitter parse "$file" 2>&1 | grep -c ERROR || true)
    if [ "$errors" = "0" ]; then
      printf "${GREEN}0 errors${RESET}\n"
      parsed=1
      break
    fi
  done

  if [ "$parsed" = "0" ]; then
    # Report best result (fewest errors)
    best=999999
    for grammar in "${GRAMMARS[@]}"; do
      dir="$SCRIPT_DIR/$grammar"
      errors=$(cd "$dir" && tree-sitter parse "$file" 2>&1 | grep -c ERROR || true)
      if [ "$errors" -lt "$best" ]; then
        best=$errors
      fi
    done
    printf "${RED}%d errors${RESET}\n" "$best"
    fail=1
  fi
done

exit $fail
