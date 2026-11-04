#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Specy Langium Build (.domain + .synth + .prd + .sysreq + .arch) ==="

echo "1. Installing dependencies..."
npm install --silent

echo "2. Generating Langium artifacts and embedding the JSON Schemas..."
npx langium generate
node scripts/embed-schemas.mjs

echo "3. Compiling TypeScript..."
npx tsc

echo "4. Validating every example file with the specy CLI..."
EXAMPLES_DIR="$SCRIPT_DIR/../../../examples"
PASS=0
FAIL=0

# Every model file in examples/ is validated, in every language. A file left out
# of this list is a file whose syntax nothing checks — which is how the grammar
# and the corpus drifted apart in the first place. Expected failures (a scenario
# written to be infeasible) are listed in EXPECTED_FAIL.
EXPECTED_FAIL=""
while IFS= read -r f; do
    rel="${f#"$EXAMPLES_DIR"/}"
    # Guard with a timeout: some inputs have hung the Langium parser in the past
    # (e.g. business-loan), and a hang must surface as a failure, not block forever.
    output=$(timeout 90 node out/cli/specy.js validate "$f" 2>&1) || rc=$?
    if [ "${rc:-0}" = "124" ]; then
        echo "  FAIL: $rel (timed out — parser hang)"
        FAIL=$((FAIL + 1))
    elif [ "${rc:-0}" = "0" ]; then
        echo "  PASS: $rel"
        PASS=$((PASS + 1))
    elif [[ " $EXPECTED_FAIL " == *" $rel "* ]]; then
        echo "  PASS: $rel (fails as expected)"
        PASS=$((PASS + 1))
    else
        echo "  FAIL: $rel"
        printf '%s\n' "$output" | grep -E "\[error\]" | head -3 | sed 's/^/      /'
        FAIL=$((FAIL + 1))
    fi
    unset rc
done < <(find "$EXAMPLES_DIR" -type f \( -name '*.domain' -o -name '*.prd' -o -name '*.sysreq' -o -name '*.arch' -o -name '*.synth' \) | sort)

echo ""
echo "Results: $PASS passed, $FAIL failed"

echo ""
echo "5. Testing the four encodings on one file per language..."
for f in ecommerce/v2/orders.domain url-shortener/url-shortener.prd url-shortener/url-shortener.sysreq url-shortener/url-shortener.arch ecommerce/v2/orders.synth; do
    for fmt in dsl json yaml markdown; do
        out=$(timeout 60 node out/cli/specy.js convert "$EXAMPLES_DIR/$f" --to "$fmt" --strict 2>/dev/null || true)
        if [ -n "$out" ]; then
            # Report bytes, not lines: JSON is emitted on a single line.
            echo "  PASS: convert $(basename "$f") --to $fmt ($(printf '%s' "$out" | wc -c) bytes)"
        else
            echo "  FAIL: convert $(basename "$f") --to $fmt (empty output)"
            FAIL=$((FAIL + 1))
        fi
    done
done

for fmt in json yaml markdown; do
    out=$(timeout 60 node out/cli/index.js parse "$EXAMPLES_DIR/ecommerce/v2/orders.domain" -f "$fmt" 2>/dev/null || true)
    if [ -n "$out" ]; then
        echo "  PASS: specy-domain parse -f $fmt ($(printf '%s' "$out" | wc -c) bytes)"
    else
        echo "  FAIL: specy-domain parse -f $fmt (empty output)"
        FAIL=$((FAIL + 1))
    fi
done
for fmt in json yaml; do
    out=$(timeout 60 node out/cli/synth.js parse "$EXAMPLES_DIR/ecommerce/v2/orders.synth" --strict -f "$fmt" 2>/dev/null || true)
    if [ -n "$out" ]; then
        echo "  PASS: specy-synth parse -f $fmt ($(printf '%s' "$out" | wc -c) bytes)"
    else
        echo "  FAIL: specy-synth parse -f $fmt (empty output)"
        FAIL=$((FAIL + 1))
    fi
done

echo ""
echo "6. Running the test suite (round trips of every example through DSL, JSON, YAML and Markdown)..."
if npx vitest run --reporter=dot 2>&1 | tail -3; then
    echo "  PASS: vitest"
else
    echo "  FAIL: vitest"
    FAIL=$((FAIL + 1))
fi

echo ""
echo "7. Bundling for the browser..."
npm run build:browser --silent

echo ""
if [ "$FAIL" -gt 0 ]; then
    echo "WARNING: $FAIL check(s) failed"
    exit 1
fi

echo "Build complete."
