#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# shellcheck source=./check-tree-sitter.sh
source "$SCRIPT_DIR/check-tree-sitter.sh"
check_tree_sitter_cli

GRAMMARS=(
  "tree-sitter-specy-prd"
  "tree-sitter-specy-sysreq"
  "tree-sitter-specy-domain"
)

EXAMPLES=(
  "examples/business-loan/business-loan.prd"
  "examples/business-loan/business-loan.sysreq"
  "examples/business-loan/business-loan.domain"
  "examples/ride-now/ride-now.prd"
  "examples/ride-now/driver-management.sysreq"
  "examples/ride-now/rider-management.sysreq"
  "examples/ride-now/ride-management.sysreq"
  "examples/ride-now/geolocation-routing.sysreq"
  "examples/ride-now/payment.sysreq"
  "examples/ride-now/platform-nfr.sysreq"
  "examples/ride-now/driver-management.domain"
  "examples/ride-now/rider-management.domain"
  "examples/ride-now/ride-management.domain"
  "examples/ride-now/geolocation-routing.domain"
  "examples/ride-now/payment.domain"
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
  matched_dir=""
  for grammar in "${GRAMMARS[@]}"; do
    dir="$SCRIPT_DIR/$grammar"
    errors=$(cd "$dir" && tree-sitter parse "$file" 2>&1 | grep -c ERROR || true)
    if [ "$errors" = "0" ]; then
      parsed=1
      matched_dir="$dir"
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
    printf "${RED}%d parse errors${RESET}\n" "$best"
    fail=1
    continue
  fi

  # Parse succeeded — also validate that the highlights query loads cleanly
  # against the file. This is what Neovim does on file open, and catches
  # stale node references in queries that `tree-sitter parse` does not.
  query_file="$matched_dir/queries/highlights.scm"
  if [ ! -f "$query_file" ]; then
    printf "${GREEN}parse OK${RESET} ${BOLD}(no query file)${RESET}\n"
    continue
  fi

  query_output=$(cd "$matched_dir" && tree-sitter query "$query_file" "$file" 2>&1) || query_failed=1
  if [ "${query_failed:-0}" = "1" ]; then
    printf "${RED}query failed${RESET}\n"
    # show first non-empty error lines to make staleness obvious
    echo "$query_output" | grep -v '^$' | head -3 | sed 's/^/      /'
    fail=1
    unset query_failed
  else
    printf "${GREEN}OK${RESET} (parse + query)\n"
  fi
done

exit $fail
