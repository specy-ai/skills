#!/usr/bin/env bash
# Builds the static assets of the hosted Navigator: an explicit copy of ui/
# into dist/public (proposals/navigator-hosting.md, §3.3).
#
# ui/ holds client models (git-ignored), symlinks into mission folders and
# tooling; none of that may ever reach a deployment. So this script copies a
# list, not a folder; rewrites data.js so no sample organization ships to a
# client; writes a .assetsignore on top as a belt; and fails if a forbidden
# file is found in the result anyway.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
UI="$(cd "$HERE/.." && pwd)"
OUT="$HERE/dist/public"

FILES="
index.html
app.js
app.css
ds-tokens.css
arch-landscape.css
domain-parser.js
sysreq-parser.js
domain-to-diagram.js
arch-parser.js
arch-to-diagram.js
arch-concepts.js
synth-view.js
synth.css
assets/specy-ai-logo-white-orbitron.svg
vendor/specy-diagram-engine.js
vendor/specy-domain-langium.js
vendor/synthy.js
"

rm -rf "$OUT"
mkdir -p "$OUT"
for f in $FILES; do
  [ -f "$UI/$f" ] || { echo "build.sh: $UI/$f missing" >&2; exit 1; }
  mkdir -p "$OUT/$(dirname "$f")"
  cp "$UI/$f" "$OUT/$f"
done

# No sample organization on a client's deployment: every model comes from the manifest.
printf '/* hosted build: no sample data, every model comes from api/models (see app.js) */\nconst MODEL = { organizations: [] };\n' > "$OUT/data.js"

# Pages of the hosting itself (403 page, admin), when they exist.
if [ -d "$HERE/public-src" ]; then cp -R "$HERE/public-src/." "$OUT/"; fi

# Belt: Wrangler skips these even if they were copied by mistake.
cat > "$OUT/.assetsignore" <<'EOF'
*.arch
*.domain
*.sysreq
*.prd
*.sh
*.md
*.mjs
scripts/
EOF

# Braces: nothing of that kind, and no symlink, may be in the result.
forbidden="$(find "$OUT" \( -name '*.arch' -o -name '*.domain' -o -name '*.sysreq' -o -name '*.prd' -o -name '*.sh' -o -name '*.mjs' -o -name '*.md' -o -type l \) -print)"
if [ -n "$forbidden" ]; then
  echo "build.sh: forbidden files in $OUT:" >&2
  echo "$forbidden" >&2
  exit 1
fi
echo "build.sh: $OUT ($(find "$OUT" -type f | wc -l | tr -d ' ') files)"
