#!/usr/bin/env bash
set -euo pipefail

# Install the Specy plugin by symlinking the built plugin (dist/) into ~/.claude/skills/specy.
# Placed there, Claude Code auto-loads it as the `specy@skills-dir` plugin, and its skills invoke as:
#   specy:prd-design  specy:sysreq-design  specy:sysreq-extract-from-code
#   specy:domain-design  specy:domain-build-code  specy:domain-extract-from-code
#   specy:domain-refactor  specy:domain-dialogue

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_SRC="$SCRIPT_DIR/dist"
PLUGIN_DST="$HOME/.claude/skills/specy"

if [ ! -f "$PLUGIN_SRC/.claude-plugin/plugin.json" ]; then
    echo "Plugin not built: $PLUGIN_SRC/.claude-plugin/plugin.json not found."
    echo "Run ./src/skills/build.sh first."
    exit 1
fi

echo "Installing the Specy plugin from $PLUGIN_SRC"
echo "Destination: $PLUGIN_DST"
echo ""

mkdir -p "$HOME/.claude/skills"

if [ -e "$PLUGIN_DST" ] || [ -L "$PLUGIN_DST" ]; then
    rm -rf "$PLUGIN_DST"
    echo "  CLEAN removed existing $PLUGIN_DST"
fi

ln -s "$PLUGIN_SRC" "$PLUGIN_DST"
echo "  OK    specy -> $PLUGIN_SRC"
echo ""
echo "Done. Skills invoke as specy:<name> — e.g. specy:domain-design, specy:domain-build-code."
echo ""
echo "Alternatives:"
echo "  claude --plugin-dir \"$PLUGIN_SRC\"                  # load for one session, no install"
echo "  claude plugin marketplace add \"$SCRIPT_DIR\" && claude plugin install specy   # via marketplace"
