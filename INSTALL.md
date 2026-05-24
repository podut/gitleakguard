# leakguard — Install Guide

## One-liner install

**macOS / Linux / WSL:**
```bash
curl -fsSL https://raw.githubusercontent.com/podut/leakguard/main/install.sh | sh
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/podut/leakguard/main/install.ps1 | iex
```

---

## npm / npx

```bash
# Run once without installing:
npx leakguard init

# Install globally:
npm install -g leakguard
leakguard init
leakguard scan
leakguard history
```

---

## Commands

```bash
leakguard init       # Setup leakguard in the current repo
leakguard scan       # Manually scan staged files for secrets
leakguard history    # Scan full git history for leaked secrets
leakguard help       # Show all commands
```

---

## What init does

```
$ npx leakguard init

  leakguard Setup

▶ Installing pre-commit hook
✓ Pre-commit hook installed → .git/hooks/pre-commit

▶ Configuring .gitignore
✓ .gitignore updated (.env, .env.local, *.pem, *.key added)

▶ Creating .env template
✓ .env.example created

✓ leakguard is active. Your next commit will be scanned automatically.
```

---

## What the pre-commit hook does

Every `git commit` is scanned automatically:

```
$ git commit -m "add openai integration"
leakguard — scanning staged files for secrets...

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

Bypass (not recommended): LEAKGUARD_BYPASS=1 git commit ...
```

---

## Detected secret types

| Type | Example pattern |
|---|---|
| AWS Access Key | `AKIA` + 16 chars |
| OpenAI API Key | `sk-proj-...` |
| Anthropic API Key | `sk-ant-api03-...` |
| GitHub Token | `ghp_...`, `github_pat_...` |
| Google API Key | `AIza...` |
| Stripe Keys | `sk_live_...`, `sk_test_...` |
| Slack Tokens | `xoxb-...` |
| Private Keys | `-----BEGIN PRIVATE KEY-----` |
| JWT Tokens | `eyJ...` |
| DB URLs with password | `scheme://user:pass@host` |
| Generic secrets | `password = "..."`, `api_key = "..."` |

---

## Bypass (emergency only)

```bash
LEAKGUARD_BYPASS=1 git commit -m "message"
```

Not recommended. Move secrets to `.env` instead.

---

## Installer flags

```bash
# Hook only (no AI editor skills)
install.sh --hook-only
install.ps1 -HookOnly

# Skip global skills (Claude, Cursor, Gemini CLI)
install.sh --no-editor-skills
install.ps1 -NoEditorSkills
```

---

## Keeper Secret Manager (optional)

For SSH commit signing stored in Keeper vault:

```bash
leakguard init
# When prompted: "Set up Keeper SSH signing? (y/N)" → type y
```

Requires a Keeper Business or Personal account with Secrets Manager enabled.
