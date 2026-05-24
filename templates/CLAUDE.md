# GitKeeper — Secret Protection Active

GitKeeper is installed in this project. Apply all rules below automatically and proactively.
Do not wait for the user to ask. Treat credential leaks as blocking issues.

---

## AUTOMATIC BEHAVIORS — trigger on these events without being asked

### On every git commit action
When the user asks you to commit, stage files, or write a commit command:
1. Run `git diff --cached --name-only --diff-filter=ACM` to get staged files
2. For each: `git show :<file>` to read the staged content
3. Scan for secret patterns (full list below)
4. **If secrets found**: do not write the commit command. Instead:
   - Show each finding: type, file:line, preview
   - Show the fix steps
   - Offer the automated fix prompt
5. **If clean**: write the commit command normally

### On every push / deploy / ship action
Before writing any `git push`, `docker push`, or deploy command:
- Confirm the last commit is clean: `git show --stat HEAD`
- Scan the diff of the last commit: `git show HEAD`
- If secrets found in HEAD → block and remediate first

### On every code generation involving external services
Rule: **always use environment variables, never hardcode values**

```typescript
// Always generate this pattern:
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Never generate this:
const client = new OpenAI({ apiKey: "sk-proj-real-key-here" });
```

After introducing any new `process.env.VAR`:
- Add `VAR=your_value_here` to `.env.example`
- Verify `.env` is in `.gitignore` — add it if missing
- Do both in the same response, not as an afterthought

### On every file read that contains a real credential
Flag before doing anything else with the file:
"This file contains what appears to be a real [AWS/OpenAI/Stripe/...] key on line [N].
This must not be committed. Moving it to `.env` now."
Then fix it automatically if you have write access.

### On every PR review or code review
Scan every added line for secret patterns before giving any other feedback.
If found: put the security finding at the very top of your review, labeled [SECURITY BLOCKER].

### On every new package install suggestion
When suggesting `npm install some-sdk`, `pip install some-lib`, etc.:
- If the package requires credentials, proactively add the env var to `.env.example`
- Example: suggesting `npm install stripe` → immediately add `STRIPE_SECRET_KEY=your_value_here` to `.env.example`

---

## SECRET PATTERNS — scan for all of these

```
AWS Access Key:    AKIA[0-9A-Z]{16}
GitHub Token:      ghp_[A-Za-z0-9]{36}  or  github_pat_[A-Za-z0-9_]{82}
OpenAI Key:        sk-[A-Za-z0-9]{48}   or  sk-proj-[A-Za-z0-9_-]{40,}
Anthropic Key:     sk-ant-api03-[A-Za-z0-9_-]{95}
Google API Key:    AIza[0-9A-Za-z_-]{35}
Stripe Live:       sk_live_[A-Za-z0-9]{24,}
Stripe Test:       sk_test_[A-Za-z0-9]{24,}
Slack Token:       xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]{24}
Private Key:       -----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----
JWT:               eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+
Credentials URL:   [a-z+.-]+://[^:@\s/]+:[^@\s]{3,}@[^\s]+
Generic secrets:   (password|secret|api_key|apikey|auth_token|access_token)\s*[=:]\s*['"][^'"]{8,}['"]
```

**Skip**: `node_modules/`, `dist/`, `build/`, `.env.example`, `*.lock`, `*.min.js`, test files with obvious placeholders

---

## REMEDIATION STEPS

### Secret in working tree (not staged)
```bash
# 1. Add to .env
echo "VARIABLE_NAME=the_real_value" >> .env

# 2. Add .env to .gitignore (if missing)
echo ".env" >> .gitignore

# 3. Replace in code
# Use process.env.VARIABLE_NAME instead of the literal value

# 4. Create .env.example entry
echo "VARIABLE_NAME=your_value_here" >> .env.example
```

### Secret staged but not committed
```bash
git restore --staged <file>
# Then fix as above
```

### Secret committed, not yet pushed
```bash
# Fix the file first (move to .env)
git add <fixed-file>
git commit --amend --no-edit
# or: git reset HEAD~1 --soft, fix, recommit
```

### Secret pushed to remote
```bash
# Step 1: REVOKE THE CREDENTIAL NOW (see provider links in project GEMINI.md)
# Step 2: Fix the code
# Step 3: Clean history
pip install git-filter-repo
git filter-repo --invert-paths --path <file-with-secret>
git push --force-with-lease origin <branch>
# Step 4: All collaborators must re-clone
```

---

## REQUIRED .gitignore ENTRIES

If `.gitignore` is missing any of these, add them without being asked:
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

---

## COMMUNICATION STYLE FOR SECURITY FINDINGS

When reporting a secret:
1. **Lead with urgency** if it's already pushed: "⚠ URGENT: This credential may already be compromised."
2. **Be specific**: name the file, line number, and type of secret
3. **Immediate next action**: the very next thing the user must do right now
4. **Do not bury** security findings in a long response — put them first

Never: "By the way, I noticed there might be a key in the file..."
Always: "[SECURITY] Found Stripe live key in src/payments.ts:14. Do not commit. Moving to .env."
