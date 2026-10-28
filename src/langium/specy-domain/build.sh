#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Specy Langium Build (.domain + .synth) ==="

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

# Every .domain file in examples/ is validated. A file left out of this list is a
# file whose syntax nothing checks — which is how the grammar and the corpus drifted
# apart in the first place.
for f in "$EXAMPLES_DIR"/conformance/all-constructs.domain \
         "$EXAMPLES_DIR"/ecommerce/v2/orders.domain \
         "$EXAMPLES_DIR"/business-loan/business-loan.domain \
         "$EXAMPLES_DIR"/url-shortener/url-shortener.domain \
         "$EXAMPLES_DIR"/ride-now/shared.domain \
         "$EXAMPLES_DIR"/ride-now/geolocation-routing.domain \
         "$EXAMPLES_DIR"/ride-now/rider-management.domain \
         "$EXAMPLES_DIR"/ride-now/driver-management.domain \
         "$EXAMPLES_DIR"/ride-now/ride-management.domain \
         "$EXAMPLES_DIR"/ride-now/payment.domain; do
    # Guard with a timeout: some inputs have hung the Langium parser in the past
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
echo "4b. Validating the .synth scenario against its domain-source..."
SYNTH_FILE="$EXAMPLES_DIR/ecommerce/v2/orders.synth"
output=$(timeout 90 node out/cli/synth.js validate "$SYNTH_FILE" 2>&1) || rc=$?
if [ "${rc:-0}" = "0" ]; then
    echo "  PASS: $(basename "$SYNTH_FILE")"
else
    echo "  FAIL: $(basename "$SYNTH_FILE")"
    printf '%s\n' "$output" | head -5 | sed 's/^/      /'
    FAIL=$((FAIL + 1))
fi
unset rc

echo ""
echo "5. Testing parse output formats..."
PARSE_FILE="$EXAMPLES_DIR/ecommerce/v2/orders.domain"
for fmt in json yaml markdown; do
    out=$(timeout 60 node out/cli/index.js parse "$PARSE_FILE" -f "$fmt" 2>/dev/null || true)
    if [ -n "$out" ]; then
        # Report bytes, not lines: JSON is emitted on a single line, so a line count
        # reads as "0" for a perfectly good 24KB document.
        echo "  PASS: parse -f $fmt ($(printf '%s' "$out" | wc -c) bytes)"
    else
        echo "  FAIL: parse -f $fmt (empty output)"
        FAIL=$((FAIL + 1))
    fi
done

for fmt in json yaml; do
    out=$(timeout 60 node out/cli/synth.js parse "$SYNTH_FILE" --strict -f "$fmt" 2>/dev/null || true)
    if [ -n "$out" ]; then
        echo "  PASS: specy-synth parse -f $fmt ($(printf '%s' "$out" | wc -c) bytes)"
    else
        echo "  FAIL: specy-synth parse -f $fmt (empty output)"
        FAIL=$((FAIL + 1))
    fi
done

echo ""
echo "6. Running the test suite..."
if npx vitest run --reporter=dot 2>&1 | tail -3; then
    echo "  PASS: vitest"
else
    echo "  FAIL: vitest"
    FAIL=$((FAIL + 1))
fi

echo ""
if [ "$FAIL" -gt 0 ]; then
    echo "WARNING: $FAIL check(s) failed"
    exit 1
fi

echo "Build complete."
