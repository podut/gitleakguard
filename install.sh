#!/usr/bin/env sh
# gitleakguard installer — works on macOS, Linux, WSL
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/podut/gitleakguard/main/install.sh | sh
#   Or locally: ./install.sh [--global] [--no-editor-skills]
#
# Flags:
#   --global          Install AI editor skills globally (~/.claude, ~/.cursor, ~/.gemini)
#   --no-editor-skills  Skip AI editor skill installation
#   --hook-only       Only install the pre-commit hook (no editor skills, no prompts)

set -e

REPO="https://raw.githubusercontent.com/podut/gitleakguard/main"
HOOK_URL="$REPO/hooks/pre-commit"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

INSTALL_GLOBAL=0
SKIP_EDITOR_SKILLS=0
HOOK_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --global)            INSTALL_GLOBAL=1 ;;
    --no-editor-skills)  SKIP_EDITOR_SKILLS=1 ;;
    --hook-only)         HOOK_ONLY=1; SKIP_EDITOR_SKILLS=1 ;;
  esac
done

step()  { printf "\n${CYAN}▶${RESET} ${BOLD}%s${RESET}\n" "$1"; }
ok()    { printf "${GREEN}✓${RESET} %s\n" "$1"; }
warn()  { printf "${YELLOW}⚠${RESET}  %s\n" "$1"; }
err()   { printf "${RED}✖${RESET}  %s\n" "$1"; }
info()  { printf "  %s\n" "$1"; }

# ── Prerequisites ─────────────────────────────────────────────────────────────

check_git() {
  if ! command -v git > /dev/null 2>&1; then
    err "git is not installed. Install it first."
    exit 1
  fi
}

check_node() {
  if ! command -v node > /dev/null 2>&1; then
    warn "Node.js not found. The pre-commit hook requires Node >= 18."
    warn "Install from: https://nodejs.org"
    return 1
  fi
  NODE_VERSION=$(node -e "process.exit(parseInt(process.versions.node) < 18 ? 1 : 0)" 2>/dev/null && echo "ok" || echo "old")
  if [ "$NODE_VERSION" = "old" ]; then
    warn "Node.js version is below 18. Hook may not work. Upgrade at: https://nodejs.org"
  fi
  return 0
}

is_git_repo() {
  git rev-parse --git-dir > /dev/null 2>&1
}

# ── Hook ──────────────────────────────────────────────────────────────────────

get_hook_content() {
  # Try to use local file first (when running from cloned repo)
  LOCAL="$(cd "$(dirname "$0")" && pwd)/hooks/pre-commit"
  if [ -f "$LOCAL" ]; then
    cat "$LOCAL"
    return
  fi
  # Fall back to downloading
  if command -v curl > /dev/null 2>&1; then
    curl -fsSL "$HOOK_URL"
  elif command -v wget > /dev/null 2>&1; then
    wget -qO- "$HOOK_URL"
  else
    err "curl or wget required to download the hook."
    exit 1
  fi
}

install_hook() {
  GIT_DIR=$(git rev-parse --git-dir)
  HOOKS_DIR="$GIT_DIR/hooks"
  HOOK_DST="$HOOKS_DIR/pre-commit"

  mkdir -p "$HOOKS_DIR"

  if [ -f "$HOOK_DST" ] && ! grep -q "gitleakguard" "$HOOK_DST" 2>/dev/null; then
    warn "Existing pre-commit hook found (not gitleakguard). Backing up to pre-commit.bak"
    cp "$HOOK_DST" "$HOOK_DST.bak"
  fi

  get_hook_content > "$HOOK_DST"
  chmod +x "$HOOK_DST"
  ok "Pre-commit hook installed → $HOOK_DST"
}

# ── .gitignore ────────────────────────────────────────────────────────────────

setup_gitignore() {
  GITIGNORE=".gitignore"
  ENTRIES=".env .env.local .env.*.local *.pem *.key"
  ADDED=0

  for entry in $ENTRIES; do
    if [ ! -f "$GITIGNORE" ] || ! grep -qxF "$entry" "$GITIGNORE" 2>/dev/null; then
      printf "%s\n" "$entry" >> "$GITIGNORE"
      ADDED=$((ADDED + 1))
    fi
  done

  if [ "$ADDED" -gt 0 ]; then
    ok ".gitignore updated ($ADDED entries added)"
  else
    ok ".gitignore already has required entries"
  fi
}

# ── .env.example ──────────────────────────────────────────────────────────────

create_env_example() {
  if [ ! -f ".env.example" ]; then
    cat > .env.example << 'EOF'
# Copy this file to .env and fill in your real values
# NEVER commit .env to git — it is in .gitignore

# AI / LLM
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mydb

# Auth
SECRET_KEY=your_secret_key_here
JWT_SECRET=your_jwt_secret_here

# Payments
STRIPE_SECRET_KEY=your_stripe_key_here
EOF
    ok ".env.example created"
  else
    ok ".env.example already exists"
  fi
}

# ── AI Editor Skills ───────────────────────────────────────────────────────────

get_file_content() {
  # $1 = local relative path, $2 = remote path suffix
  LOCAL="$(cd "$(dirname "$0")" && pwd)/$1"
  if [ -f "$LOCAL" ]; then
    cat "$LOCAL"
  else
    if command -v curl > /dev/null 2>&1; then
      curl -fsSL "$REPO/$2"
    else
      wget -qO- "$REPO/$2"
    fi
  fi
}

install_claude_skill() {
  TARGET="$HOME/.claude/commands/gitleakguard.md"
  mkdir -p "$HOME/.claude/commands"
  get_file_content ".claude/commands/gitleakguard.md" ".claude/commands/gitleakguard.md" > "$TARGET"
  ok "Claude Code skill → $TARGET"
  info "Use /gitleakguard in any Claude Code conversation"
}

install_cursor_skill() {
  TARGET_DIR="$HOME/.cursor/skills/gitleakguard"
  mkdir -p "$TARGET_DIR"
  get_file_content "skills/gitleakguard/SKILL.md" "skills/gitleakguard/SKILL.md" > "$TARGET_DIR/SKILL.md"
  ok "Cursor skill → $TARGET_DIR/SKILL.md"
  info "Use /gitleakguard in Cursor Agent mode"
}

install_gemini_skill() {
  if ! command -v gemini > /dev/null 2>&1; then
    warn "Gemini CLI not found — skipping skill install"
    info "Install with: npm install -g @google/gemini-cli"
    return
  fi

  SKILL_FILE="/tmp/gitleakguard-$$.skill"
  if command -v curl > /dev/null 2>&1; then
    curl -fsSL "$REPO/gitleakguard.skill" -o "$SKILL_FILE" 2>/dev/null || SKILL_FILE=""
  fi

  LOCAL="$(cd "$(dirname "$0")" && pwd)/gitleakguard.skill"
  [ -f "$LOCAL" ] && SKILL_FILE="$LOCAL"

  if [ -n "$SKILL_FILE" ] && [ -f "$SKILL_FILE" ]; then
    echo "Y" | gemini skills install "$SKILL_FILE" --scope user > /dev/null 2>&1 && \
      ok "Gemini CLI skill installed" && \
      info "Run /skills reload in Gemini CLI, then use /gitleakguard" || \
      warn "Gemini skill install failed — run manually: gemini skills install gitleakguard.skill --scope user"
    [ "$SKILL_FILE" = "/tmp/gitleakguard-$$.skill" ] && rm -f "$SKILL_FILE"
  else
    warn "Could not get gitleakguard.skill — skipping Gemini install"
  fi
}

install_project_instructions() {
  step "Installing AI instruction files in project"

  # GEMINI.md — picked up by Gemini CLI and Antigravity (always-active rules)
  if [ ! -f "GEMINI.md" ]; then
    get_file_content "templates/GEMINI.md" "templates/GEMINI.md" > GEMINI.md
    ok "GEMINI.md → project root (Gemini CLI + Antigravity)"
  else
    # Append gitleakguard block if not already present
    if ! grep -q "gitleakguard" GEMINI.md 2>/dev/null; then
      printf "\n" >> GEMINI.md
      get_file_content "templates/GEMINI.md" "templates/GEMINI.md" >> GEMINI.md
      ok "GEMINI.md → gitleakguard rules appended"
    else
      ok "GEMINI.md already has gitleakguard rules"
    fi
  fi

  # CLAUDE.md — picked up by Claude Code (always-active rules)
  if [ ! -f "CLAUDE.md" ]; then
    get_file_content "templates/CLAUDE.md" "templates/CLAUDE.md" > CLAUDE.md
    ok "CLAUDE.md → project root (Claude Code)"
  else
    if ! grep -q "gitleakguard" CLAUDE.md 2>/dev/null; then
      printf "\n" >> CLAUDE.md
      get_file_content "templates/CLAUDE.md" "templates/CLAUDE.md" >> CLAUDE.md
      ok "CLAUDE.md → gitleakguard rules appended"
    else
      ok "CLAUDE.md already has gitleakguard rules"
    fi
  fi

  # .cursor/rules/gitleakguard.mdc — Cursor always-on rule (alwaysApply: true)
  if [ ! -f ".cursor/rules/gitleakguard.mdc" ]; then
    mkdir -p .cursor/rules
    get_file_content "templates/cursor-rule.mdc" "templates/cursor-rule.mdc" > .cursor/rules/gitleakguard.mdc
    ok ".cursor/rules/gitleakguard.mdc → Cursor (always active)"
  else
    ok ".cursor/rules/gitleakguard.mdc already installed"
  fi

  # .vscode/tasks.json — VSCode run tasks
  if [ ! -f ".vscode/tasks.json" ]; then
    mkdir -p .vscode
    get_file_content ".vscode/tasks.json" ".vscode/tasks.json" > .vscode/tasks.json
    ok ".vscode/tasks.json → VSCode run tasks"
    info "Use Ctrl+Shift+P → Run Task → Gitleakguard"
  else
    ok ".vscode/tasks.json already configured"
  fi
}

install_global_skills() {
  step "Installing global AI editor skills"
  install_claude_skill
  install_cursor_skill
  install_gemini_skill
}

install_editor_skills() {
  install_project_instructions
  install_global_skills
}

# ── Main ──────────────────────────────────────────────────────────────────────

main() {
  printf "\n${BOLD}${CYAN}  gitleakguard${RESET} — Git secret protection\n\n"

  check_git
  check_node || true

  if ! is_git_repo; then
    err "Not a git repository. Run: git init"
    exit 1
  fi

  step "Installing pre-commit hook"
  install_hook

  if [ "$HOOK_ONLY" -eq 1 ]; then
    printf "\n${GREEN}${BOLD}  ✓ Hook installed.${RESET}\n\n"
    exit 0
  fi

  step "Configuring .gitignore"
  setup_gitignore

  step "Creating .env.example"
  create_env_example

  # Always install project-level instruction files (GEMINI.md, CLAUDE.md, cursor rule)
  install_project_instructions

  # Install global skills (Claude, Cursor, Gemini CLI) unless --no-editor-skills
  if [ "$SKIP_EDITOR_SKILLS" -eq 0 ]; then
    install_global_skills
  fi

  printf "\n${GREEN}${BOLD}  ✓ gitleakguard is active.${RESET}\n"
  printf "  Your next commit will be scanned automatically.\n\n"
  printf "  Scan staged files now : ${CYAN}node hooks/pre-commit${RESET}\n"
  printf "  Scan git history      : ${CYAN}node setup/scan-history.js${RESET}\n\n"
}

main "$@"
