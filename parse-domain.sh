#!/usr/bin/env bash
# parse-domain.sh — parse a Specy `.domain` file into JSON, YAML, or Markdown.
#
# A thin wrapper around the Langium parser CLI in src/langium/specy-domain/.
# Builds the parser automatically on first use, then forwards to its `parse`
# command. Run it from anywhere — paths are resolved relative to your shell.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LANGIUM_DIR="$SCRIPT_DIR/src/langium/specy-domain"
CLI="$LANGIUM_DIR/out/cli/index.js"

usage() {
    cat <<'EOF'
Usage: ./parse-domain.sh <file.domain> [options]

Parse a Specy .domain file into a structured output format.

Options:
  -f, --format <fmt>   Output format: json (default), yaml, or markdown
      --pretty         Pretty-print JSON output
      --raw            Emit the faithful Langium AST instead of the clean
                       domain model (json/yaml only)
  -h, --help           Show this help

Examples:
  ./parse-domain.sh examples/ecommerce/v2/orders.domain -f markdown
  ./parse-domain.sh examples/ecommerce/v2/orders.domain -f yaml > orders.yaml
  ./parse-domain.sh examples/ecommerce/v2/orders.domain -f json --pretty
EOF
}

if [ "$#" -eq 0 ] || [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
    usage
    [ "$#" -eq 0 ] && exit 1 || exit 0
fi

FILE="$1"
shift

if [ ! -f "$FILE" ]; then
    echo "Error: file not found: $FILE" >&2
    exit 1
fi
# Absolute path, so the CLI resolves it regardless of the working directory.
FILE="$(cd "$(dirname "$FILE")" && pwd)/$(basename "$FILE")"

# Build on first use if the parser hasn't been compiled yet. build.sh may exit
# non-zero on a failing acceptance example while still producing out/, so we
# tolerate its exit code and re-check for the compiled CLI.
if [ ! -f "$CLI" ]; then
    echo "Parser not built yet — building (one-time)…" >&2
    "$LANGIUM_DIR/build.sh" >&2 || true
    if [ ! -f "$CLI" ]; then
        echo "Error: build did not produce $CLI" >&2
        exit 1
    fi
fi

exec node "$CLI" parse "$FILE" "$@"
