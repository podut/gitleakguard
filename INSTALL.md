# GitKeeper — Install Guide

## Quick install (npx, no setup needed)

```bash
npx gitkeeper init
```

Runs setup in the current git repository. Installs the pre-commit hook, updates `.gitignore`, and creates `.env.example`.

---

## Commands

```bash
npx gitkeeper init       # Setup GitKeeper in the current repo
npx gitkeeper scan       # Manually scan staged files for secrets
npx gitkeeper history    # Scan full git history for leaked secrets
npx gitkeeper help       # Show all commands
```

---

## Global install (run anywhere without npx)

```bash
npm install -g gitkeeper

gitkeeper init
gitkeeper scan
gitkeeper history
```

---

## What init does

```
$ npx gitkeeper init

  GitKeeper Setup

▶ Installing pre-commit hook
✓ Pre-commit hook installed → .git/hooks/pre-commit

▶ Configuring .gitignore
✓ .gitignore updated (.env, .env.local, *.pem, *.key added)

▶ Creating .env template
✓ .env.example created

✓ GitKeeper is active. Your next commit will be scanned automatically.
```

---

## What the pre-commit hook does

Every `git commit` is scanned automatically:

```
$ git commit -m "add openai integration"
GitKeeper — scanning staged files for secrets...

✖  Commit blocked — 1 secret(s) detected:

  ● OpenAI API Key
    File : src/api.js:14
    Line : const apiKey = "sk-proj-abc123..."

How to fix:
  1. Move the secret to .env
  2. Add .env to .gitignore
  3. Replace in code with process.env.OPENAI_API_KEY
  4. Revoke and rotate the exposed credential

AI prompt (paste in Cursor / Claude / Gemini):
  "Find all hardcoded credentials and move them to .env,
   replacing each with process.env.VARIABLE_NAME"

Bypass (not recommended): GITKEEPER_BYPASS=1 git commit ...
```

---

## Detected secret types

| Type | Example pattern |
|---|---|
| AWS Access Key | `AKIA...` |
| OpenAI API Key | `sk-proj-...` |
| Anthropic API Key | `sk-ant-api03-...` |
| GitHub Token | `ghp_...`, `github_pat_...` |
| Google API Key | `AIza...` |
| Stripe Keys | `sk_live_...`, `sk_test_...` |
| Slack Tokens | `xoxb-...` |
| Private Keys | `-----BEGIN PRIVATE KEY-----` |
| JWT Tokens | `eyJ...` |
| DB URLs with password | `postgresql://user:pass@host` |
| Generic secrets | `password = "..."`, `api_key = "..."` |

---

## Bypass (emergency only)

```bash
GITKEEPER_BYPASS=1 git commit -m "message"
```

Not recommended. Move secrets to `.env` instead.

---

## AI editor integration

After `npx gitkeeper init`, add the skill to your AI editor:

### Claude Code
```bash
# Copy to global Claude commands (available in all projects)
cp node_modules/gitkeeper/.claude/commands/gitkeeper.md ~/.claude/commands/

# Or keep it per-project (already in .claude/commands/ after init)
```
Then use `/gitkeeper` in any Claude Code conversation.

### Cursor
```bash
# Copy to global Cursor skills (available in all projects)
cp -r node_modules/gitkeeper/.cursor/skills/gitkeeper ~/.cursor/skills/

# Or keep it per-project (already in .cursor/skills/ after init)
```
Then use `/gitkeeper` in Cursor Agent.

### Gemini CLI
```bash
# Package and install the skill globally
node node_modules/gitkeeper/scripts/install-gemini-skill.js
```
Then use `/skills` in Gemini CLI to activate `gitkeeper`.

### VSCode
Tasks are added to `.vscode/tasks.json` automatically during init.
Use `Ctrl+Shift+P → Tasks: Run Task → GitKeeper: Scan Staged Files`.

---

## Keeper Secret Manager (optional)

For SSH commit signing stored in Keeper vault:

```bash
npx gitkeeper init
# When prompted: "Set up Keeper SSH signing? (y/N)" → type y
# Follow the steps to connect your KSM one-time token
```

Requires a Keeper Business or Personal account with Secrets Manager enabled.
