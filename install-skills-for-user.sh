#!/usr/bin/env bash
set -euo pipefail

# Install Specy skills by symlinking from this repo to ~/.claude/skills/
# Skills: distill-v3, dialogue, spec, prd, sysreq, domain

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_SRC="$SCRIPT_DIR/dist"
SKILLS_DST="$HOME/.claude/skills"

SKILLS=(distill-v3 dialogue spec prd sysreq domain)

echo "Installing Specy skills from $SKILLS_SRC"
echo "Destination: $SKILLS_DST"
echo ""

for skill in "${SKILLS[@]}"; do
    src="$SKILLS_SRC/$skill"
    dst="$SKILLS_DST/$skill"

    if [ ! -d "$src" ]; then
        echo "  SKIP  $skill (source directory not found)"
        continue
    fi

    # Remove existing skill directory or symlink
    if [ -e "$dst" ] || [ -L "$dst" ]; then
        rm -rf "$dst"
        echo "  CLEAN $skill (removed existing)"
    fi

    # Create symlink to the entire skill directory
    ln -s "$src" "$dst"
    echo "  OK    $skill -> $src"
done

echo ""
echo "Done. Installed ${#SKILLS[@]} skills."
