#!/usr/bin/env bash
# specy.sh — convert and validate Specy models between DSL, JSON, YAML and Markdown.
#
# A thin wrapper around the `specy` CLI of the Langium package in
# src/langium/specy-domain/ (see src/metamodels/MODEL-FORMATS.md). Builds the
# package automatically on first use, then forwards every argument. Run it from
# anywhere — paths are resolved relative to your shell.
#
#   ./specy.sh convert examples/ecommerce/v2/orders.domain --to markdown
#   ./specy.sh convert orders.domain.md --to dsl -o orders.domain
#   ./specy.sh validate examples/url-shortener/url-shortener.prd
#   ./specy.sh formats
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LANGIUM_DIR="$SCRIPT_DIR/src/langium/specy-domain"
CLI="$LANGIUM_DIR/out/cli/specy.js"

if [ "$#" -eq 0 ]; then
    set -- --help
fi

# Build on first use if the CLI hasn't been compiled yet. build.sh may exit
# non-zero on a failing acceptance example while still producing out/, so we
# tolerate its exit code and re-check for the compiled CLI.
if [ ! -f "$CLI" ]; then
    echo "specy not built yet — building (one-time)…" >&2
    "$LANGIUM_DIR/build.sh" >&2 || true
    if [ ! -f "$CLI" ]; then
        echo "Error: build did not produce $CLI" >&2
        exit 1
    fi
fi

exec node "$CLI" "$@"
