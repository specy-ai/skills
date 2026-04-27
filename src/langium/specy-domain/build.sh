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
    errors=$(node out/cli/index.js validate "$f" 2>&1 | grep -c "\[error\]" || true)
    if [ "$errors" = "0" ]; then
        echo "  PASS: $(basename "$f")"
        PASS=$((PASS + 1))
    else
        echo "  FAIL: $(basename "$f") ($errors errors)"
        FAIL=$((FAIL + 1))
    fi
done

echo ""
echo "Results: $PASS passed, $FAIL failed"

if [ "$FAIL" -gt 0 ]; then
    echo "WARNING: Some acceptance tests failed"
    exit 1
fi

echo ""
echo "Build complete."
