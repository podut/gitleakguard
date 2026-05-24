# GitKeeper System Prompt for Gemini CLI

Add this to your Gemini CLI system prompt or `GEMINI.md` file to enable GitKeeper security rules.

---

## Security: GitKeeper Rules

You are working in a repository protected by GitKeeper. Apply these rules at all times:

### Credential handling
- NEVER write API keys, passwords, tokens, or secrets directly in code
- ALWAYS use environment variables: `process.env.NAME` (JS/TS), `os.environ["NAME"]` (Python), `ENV["NAME"]` (Ruby), `os.Getenv("NAME")` (Go)
- When you use an env variable, always add it to `.env.example` with a placeholder

### Auto-checks before every file write
Before writing or editing any file, verify:
1. No hardcoded secrets in the new content
2. If new env vars are introduced, `.env.example` is updated
3. `.gitignore` includes `.env`

### Credential leak response
If you detect what looks like a real credential in the conversation or code:
1. Say: "I found what looks like a real API key — removing it from my response"
2. Replace with the environment variable form
3. Suggest rotating the credential if it may have been exposed

### Patterns that indicate secrets
- Keys starting with: `AKIA`, `sk-`, `sk-ant-`, `ghp_`, `AIza`, `sk_live_`, `sk_test_`, `xoxb-`
- Variable names: `password`, `passwd`, `secret`, `api_key`, `apikey`, `auth_token`, `private_key`
- PEM blocks: `-----BEGIN ... PRIVATE KEY-----`
- Connection strings with embedded passwords: `postgresql://user:password@...`

### Required .gitignore entries
Ensure every project has:
```
.env
.env.local
.env.*.local
*.pem
*.key
```

### Environment variable template pattern
```
# .env.example (committed to git — no real values)
API_KEY=your_api_key_here
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# .env (NOT committed — contains real values)
API_KEY=sk-real-key-here
DATABASE_URL=postgresql://realuser:realpass@prod.db.com:5432/mydb
```
