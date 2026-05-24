---
inclusion: always
---

# GitKeeper — Secret Protection Active

This project has GitKeeper installed. You must enforce the rules below automatically,
without waiting to be asked. Act proactively on every relevant event.

---

## AUTOMATIC TRIGGERS — do these without being asked

### 1. Before every git commit (any mention of "commit", "git commit", "stage and commit")

Run immediately:
```
git diff --cached --name-only --diff-filter=ACM
```
For each staged file:
```
git show :<filename>
```
Scan the content for secrets (see patterns below).

- If secrets found → STOP. Do not write the commit command. Show findings and fix steps.
- If clean → proceed with the commit suggestion.

### 2. Before every git push (any mention of "push", "deploy", "ship", "release", "go live")

Say: "Checking for secrets before push..." then scan all staged and recently committed files.
If any secret is found in the last commit → warn before the push command.
Remind: once pushed to a public repo, a credential is compromised even if deleted later.

### 3. When writing any code that contacts an external service

Automatically use environment variables. Never write real values:
```js
// Always write this:
const key = process.env.SERVICE_API_KEY;

// Never write this:
const key = "sk-real-value-here";
```

For each new env var introduced in code:
- Add to `.env.example`: `SERVICE_API_KEY=your_value_here`
- Confirm `.env` is in `.gitignore` — if not, add it immediately

### 4. When a file is opened or read that contains what looks like a real credential

Flag it immediately before doing anything else:
"Found what appears to be a real [Type] key in [file]:[line]. This should not be in source code."
Then offer to move it to `.env` and replace with `process.env.VAR`.

### 5. When a new npm package, pip package, or SDK is added that requires credentials

Proactively create the `.env.example` entry before the user asks:
"This package requires an API key. I've added `PACKAGE_API_KEY=your_value_here` to `.env.example`. Add the real value to `.env` (never commit `.env`)."

### 6. When reviewing a pull request or reading a diff

Scan every added line (`+` prefix) for the secret patterns below.
Report any findings at the top of your review — before any other feedback.

---

## SECRET PATTERNS — detect all of these

| Type | Pattern | Example shape |
|---|---|---|
| AWS Access Key | `AKIA[0-9A-Z]{16}` | `AKIA` + 16 uppercase alphanum chars |
| AWS Secret | 40-char base64 after aws_secret | 40-char mixed-case base64 string |
| GitHub Token | `ghp_[36 chars]` or `github_pat_[82 chars]` | `ghp_` + 36 alphanumeric chars |
| OpenAI Key | `sk-[48+ chars]` or `sk-proj-[40+ chars]` | `sk-proj-` + 40+ alphanumeric chars |
| Anthropic Key | `sk-ant-api03-[95 chars]` | `sk-ant-api03-` + 95 chars |
| Google API Key | `AIza[0-9A-Za-z_-]{35}` | `AIza` + 35 alphanumeric chars |
| Stripe Live | `sk_live_[24+ chars]` | `sk_live_` + 24+ alphanumeric chars |
| Stripe Test | `sk_test_[24+ chars]` | `sk_test_` + 24+ alphanumeric chars |
| Slack Token | `xoxb-[numbers]-[numbers]-[24 chars]` | `xoxb-` + numbers + `-` + 24 chars |
| Firebase | `AAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140}` | server key |
| Private Key | `-----BEGIN (RSA\|EC\|DSA\|OPENSSH)? PRIVATE KEY-----` | any PEM block |
| JWT | `eyJ[base64].[base64].[base64]` | 3-segment base64 token |
| Credentials in URL | `scheme://user:password@host` | `postgresql://admin:pass@db.host` |
| Generic secrets | `(password\|passwd\|secret\|api_key\|apikey\|auth_token\|access_token)\s*[=:]\s*['"][^'"]{8,}['"]` | `password = "abc123xyz"` |

**Ignore these (false positives):**
- Files: `node_modules/`, `dist/`, `build/`, `.env.example`, `.env.template`, `*.lock`, `*.min.js`
- Placeholder values: `your_key_here`, `xxx`, `replace_me`, `changeme`, `example`, `dummy`
- Test fixtures with clearly fake data

---

## REMEDIATION — always provide these steps when a secret is found

### When secret is NOT yet committed (still in working tree or staged)
1. `git restore --staged <file>` — unstage the file
2. Move the value to `.env`: `VARIABLE_NAME=the_real_value`
3. Add `.env` to `.gitignore` if not present
4. Replace in code: `process.env.VARIABLE_NAME`
5. Add to `.env.example`: `VARIABLE_NAME=your_value_here`
6. Re-stage and commit the clean version

### When secret IS committed but not pushed
1. Do NOT push
2. Move to `.env` and fix the code first
3. Amend the commit: `git commit --amend` (rewrites local history)
4. Or reset and recommit: `git reset HEAD~1 --soft` then recommit cleanly

### When secret IS already pushed to a remote
1. **REVOKE IMMEDIATELY** — the credential is compromised regardless of cleanup:
   - OpenAI: platform.openai.com → API Keys → Revoke
   - Anthropic: console.anthropic.com → API Keys → Delete
   - GitHub: Settings → Developer Settings → Tokens → Delete
   - AWS: IAM → Users → Security Credentials → Deactivate
   - Stripe: dashboard.stripe.com → Developers → API Keys → Roll Key
   - Google: console.cloud.google.com → APIs → Credentials → Delete
2. Fix the code (move to `.env`, use `process.env.VAR`)
3. Clean history: `pip install git-filter-repo && git filter-repo --invert-paths --path <file>`
4. Force push: `git push --force-with-lease`
5. Notify all collaborators to re-clone

---

## COPY-PASTE FIX PROMPT

When a secret is found, always provide this prompt the user can paste in any AI editor:

```
Caută toate credențialele hardcodate din proiect (API keys, tokens, parole, connection strings).
Pentru fiecare: mută în .env, adaugă .env în .gitignore, înlocuiește cu process.env.VARIABLE_NAME,
adaugă în .env.example cu valoare placeholder (nu valori reale).
```

```
Find all hardcoded credentials (API keys, tokens, passwords, connection strings).
For each: move to .env, add .env to .gitignore, replace with process.env.VARIABLE_NAME,
add to .env.example with placeholder value (no real values).
```

---

## GITIGNORE MINIMUM — ensure these are always present

```
.env
.env.local
.env.*.local
.env.production
*.pem
*.key
*.p12
*.pfx
```
