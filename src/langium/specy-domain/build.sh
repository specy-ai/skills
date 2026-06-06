#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Specy Domain Langium Build ==="

echo "1. Installing dependencies..."
npm install --silent

echo "2. Generating Langium artifacts..."
npx langium generate

echo "3. Compiling TypeScript..."
npx tsc

echo "4. Testing against example files..."
EXAMPLES_DIR="$SCRIPT_DIR/../../../examples"
PASS=0
FAIL=0

for f in "$EXAMPLES_DIR"/ecommerce/v2/orders.domain \
         "$EXAMPLES_DIR"/business-loan/business-loan.domain; do
    # Guard with a timeout: some inputs currently hang the Langium parser
    # (e.g. business-loan), and a hang must surface as a failure, not block forever.
    output=$(timeout 90 node out/cli/index.js validate "$f" 2>&1) || rc=$?
    if [ "${rc:-0}" = "124" ]; then
        echo "  FAIL: $(basename "$f") (timed out — parser hang)"
        FAIL=$((FAIL + 1))
    elif [ "$(printf '%s' "$output" | grep -c "\[error\]")" = "0" ]; then
        echo "  PASS: $(basename "$f")"
        PASS=$((PASS + 1))
    else
        echo "  FAIL: $(basename "$f") ($(printf '%s' "$output" | grep -c "\[error\]") errors)"
        FAIL=$((FAIL + 1))
    fi
    unset rc
done

echo ""
echo "Results: $PASS passed, $FAIL failed"

echo ""
echo "5. Testing parse output formats..."
PARSE_FILE="$EXAMPLES_DIR/ecommerce/v2/orders.domain"
for fmt in json yaml markdown; do
    out=$(timeout 60 node out/cli/index.js parse "$PARSE_FILE" -f "$fmt" 2>/dev/null || true)
    if [ -n "$out" ]; then
        echo "  PASS: parse -f $fmt ($(printf '%s' "$out" | wc -l) lines)"
    else
        echo "  FAIL: parse -f $fmt (empty output)"
        FAIL=$((FAIL + 1))
    fi
done

echo ""
if [ "$FAIL" -gt 0 ]; then
    echo "WARNING: $FAIL check(s) failed"
    exit 1
fi

echo "Build complete."
