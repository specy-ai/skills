#!/usr/bin/env bash
# =============================================================================
# Shared helper — ensures the tree-sitter CLI is on PATH; if not, proposes
# an OS-appropriate install command and prompts the user.
#
# Usage:
#   SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
#   # shellcheck source=./check-tree-sitter.sh
#   source "$SCRIPT_DIR/check-tree-sitter.sh"
#   check_tree_sitter_cli
#
# Behavior: returns 0 silently if `tree-sitter` is already on PATH. Otherwise
# detects the host OS, proposes an idiomatic install command, prompts the
# user (default no), runs the command on accept, and exits 1 on decline or
# unknown OS so the caller never proceeds against a broken setup.
# =============================================================================

# Refuse to run as an entry point — this file is sourced by other scripts.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "ERROR: $(basename "${BASH_SOURCE[0]}") is meant to be sourced, not executed." >&2
  echo "       From a build/install script, do:" >&2
  echo "         source \"\$SCRIPT_DIR/$(basename "${BASH_SOURCE[0]}")\"" >&2
  exit 1
fi

check_tree_sitter_cli() {
  if command -v tree-sitter >/dev/null 2>&1; then
    return 0
  fi

  echo "tree-sitter CLI not found on PATH."

  local os_kernel install_cmd=""
  os_kernel="$(uname)"

  case "$os_kernel" in
    Darwin)
      if command -v brew >/dev/null 2>&1; then
        install_cmd="brew install tree-sitter"
      elif command -v cargo >/dev/null 2>&1; then
        install_cmd="cargo install tree-sitter-cli"
      elif command -v npm >/dev/null 2>&1; then
        install_cmd="npm install -g tree-sitter-cli"
      fi
      ;;
    Linux)
      if [[ -f /etc/os-release ]]; then
        # shellcheck disable=SC1091
        . /etc/os-release
        case "${ID:-}:${ID_LIKE:-}" in
          *arch*)
            install_cmd="sudo pacman -S --needed tree-sitter-cli"
            ;;
          *fedora*|*rhel*|*centos*)
            install_cmd="sudo dnf install -y tree-sitter-cli"
            ;;
          *suse*)
            install_cmd="sudo zypper install -y tree-sitter-cli"
            ;;
        esac
      fi
      # Debian/Ubuntu and unknown distros: prefer cargo, fall back to npm.
      # (tree-sitter-cli is not in Debian/Ubuntu apt repos as of 2026.)
      if [[ -z "$install_cmd" ]]; then
        if command -v cargo >/dev/null 2>&1; then
          install_cmd="cargo install tree-sitter-cli"
        elif command -v npm >/dev/null 2>&1; then
          install_cmd="npm install -g tree-sitter-cli"
        fi
      fi
      ;;
  esac

  if [[ -z "$install_cmd" ]]; then
    echo "ERROR: Could not determine an install command for your OS ($os_kernel)."
    echo "       Install tree-sitter CLI manually, then re-run this script:"
    echo "         https://tree-sitter.github.io/tree-sitter/cli/index.html"
    exit 1
  fi

  echo "Suggested install: $install_cmd"
  printf "Run it now? [y/N] "
  local reply=""
  read -r reply || reply=""
  case "$reply" in
    [Yy]|[Yy][Ee][Ss])
      echo "+ $install_cmd"
      if ! eval "$install_cmd"; then
        echo ""
        echo "ERROR: install command failed — see output above."
        exit 1
      fi
      if ! command -v tree-sitter >/dev/null 2>&1; then
        echo ""
        echo "Install completed but 'tree-sitter' is still not on PATH."
        echo "You may need to add ~/.cargo/bin or the npm global bin to PATH,"
        echo "then re-run this script."
        exit 1
      fi
      echo "tree-sitter CLI is now available ($(tree-sitter --version | head -n1))."
      ;;
    *)
      echo ""
      echo "Aborted. Install tree-sitter CLI manually and re-run this script."
      exit 1
      ;;
  esac
}
