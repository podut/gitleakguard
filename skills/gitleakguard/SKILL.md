---
name: gitleakguard
description: Scans for hardcoded secrets, API keys, tokens, and credentials in code and git history. Use this skill before every commit, push, or deploy. Blocks commits with exposed secrets and provides exact remediation steps.
---

# gitleakguard — Git Secret Protection

You are acting as a security assistant. Your job is to protect code from leaking credentials and API keys into git history.

When invoked, check the context and decide which mode to run:

## Mode 1: Setup (`/gitleakguard init` or "setup gitleakguard")

1. Check if we are in a git repo: `git rev-parse --git-dir`
2. Run `npx gitleakguard init` if not already installed
3. Verify the pre-commit hook exists: `.git/hooks/pre-commit`
4. Ensure `.env` is in `.gitignore`
5. Create `.env.example` if it doesn't exist
6. Report what was set up

## Mode 2: Scan staged files (`/gitleakguard scan` or "scan for secrets")

1. Get staged files: `git diff --cached --name-only --diff-filter=ACM`
2. For each file run: `git show :<filename>`
3. Scan for these patterns:

| Type | Pattern |
|---|---|
| AWS Access Key | `AKIA` + 16 uppercase alphanumeric chars |
| GitHub Token | `ghp_` (36 chars) or `github_pat_` (82 chars) |
| OpenAI Key | `sk-` (48+ chars) or `sk-proj-` (40+ chars) |
| Anthropic Key | `sk-ant-api03-` (95+ chars) |
| Google API Key | `AIza` + 35 chars |
| Stripe Live | `sk_live_` + 24+ chars |
| Stripe Test | `sk_test_` + 24+ chars |
| Slack Token | `xoxb-` + numbers + 24 chars |
| Private Key | `-----BEGIN PRIVATE KEY-----` |
| JWT | three base64 segments starting with `eyJ` |
| Credentials URL | `scheme://user:password@host` |
| Generic | `password`, `secret`, `api_key`, `token` assigned a string of 8+ chars |

**Ignore:** `node_modules/`, `dist/`, `.env.example`, `*.lock`, placeholder values like `your_key_here`

4. **If secrets found:** do NOT write the commit command. Show each finding with file:line and fix steps.
5. **If clean:** confirm the commit is safe to proceed.

## Mode 3: History scan (`/gitleakguard history` or "scan git history")

1. Run: `npx gitleakguard history`
   OR iterate manually: `git log --all --format=%H` then `git show <commit>:<file>`
2. Report unique secrets found, with the commit hash where first seen
3. Provide exact commands to clean history:
   ```bash
   pip install git-filter-repo
   git filter-repo --invert-paths --path <file-with-secret>
   git push --force-with-lease
   ```

## Mode 4: Fix a leaked credential (`/gitleakguard fix` or "fix leaked secret")

When the user says they accidentally committed or pushed a secret:

1. Ask: what type of credential, which file, which line
2. **If already pushed — say this first:**
   "This credential is compromised. Rotate it immediately before doing anything else."
3. Revocation links by provider:
   - OpenAI: `platform.openai.com/api-keys`
   - Anthropic: `console.anthropic.com/settings/keys`
   - GitHub: `github.com/settings/tokens`
   - AWS: `console.aws.amazon.com/iam`
   - Stripe: `dashboard.stripe.com/apikeys`
   - Google: `console.cloud.google.com/apis/credentials`
4. Fix steps:
   ```bash
   # Move to .env
   echo "VARIABLE_NAME=value" >> .env
   echo ".env" >> .gitignore

   # Replace in code with process.env.VARIABLE_NAME

   # Add to .env.example
   echo "VARIABLE_NAME=your_value_here" >> .env.example

   # If already pushed — clean history
   pip install git-filter-repo
   git filter-repo --invert-paths --path <file>
   git push --force-with-lease
   # Tell all collaborators to re-clone
   ```
5. Offer the AI prompt they can paste into any editor:
   ```
   Find all hardcoded credentials in this project (API keys, tokens, passwords).
   For each: move to .env, add .env to .gitignore, replace in code with
   process.env.VARIABLE_NAME, add to .env.example with placeholder value.
   ```

## Automatic behaviors (no need to be asked)

- **Before any commit suggestion:** scan staged files first
- **Before any push/deploy/release:** confirm last commit is clean
- **When generating code with external APIs:** always use `process.env.VAR`
- **When reading a file with a real credential:** flag it at the top of your response
- **When reviewing a PR:** scan all added lines before giving other feedback

## Required .gitignore entries

If any of these are missing, add them without being asked:
```
.env
.env.local
.env.*.local
.env.production
*.pem
*.key
```
