---
name: njsscan
description: Static security analysis for Node.js, JavaScript and TypeScript code. Detects SQL injection, XSS, insecure crypto, prototype pollution, path traversal, and other OWASP vulnerabilities in source code. Use when reviewing JS/TS files or before merging PRs.
---

# njsscan — Node.js Security Scanner

njsscan uses semantic grep patterns to find security vulnerabilities in JS/TS source code.

## Scan current project

```bash
# Install
pip install njsscan

# Scan all JS/TS files
njsscan .

# Output as JSON (for CI)
njsscan --json -o report.json .

# Docker (no install)
docker run --rm -v "$(pwd):/code" opensecurity/njsscan /code
```

## What it detects

| Vulnerability | Example |
|---|---|
| SQL Injection | `db.query("SELECT * WHERE id=" + userId)` |
| XSS | `res.send("<h1>" + req.query.name + "</h1>")` |
| Insecure crypto | `crypto.createHash('md5')`, `Math.random()` for tokens |
| Prototype pollution | `Object.assign({}, req.body)` without validation |
| Path traversal | `fs.readFile(req.params.file)` |
| Command injection | `exec(req.body.cmd)` |
| Hardcoded secrets | Variables named `password`, `secret` with values |
| Insecure regex | ReDoS-vulnerable patterns |
| eval() usage | `eval(userInput)` |
| Weak JWT | `jwt.verify` without algorithm check |

## Automatic trigger

When reviewing any `.js`, `.ts`, `.mjs` file:
1. Scan the file mentally for the patterns above
2. Flag findings at the TOP of your response as `[SECURITY]`
3. Suggest the secure alternative

## Integration with CI

```yaml
- name: njsscan
  run: |
    pip install njsscan
    njsscan --exit-warning .
```

## When vulnerabilities are found

1. Show the vulnerable line and explain why it's dangerous
2. Provide the secure rewrite
3. Link to OWASP reference if relevant
4. Check if the pattern appears elsewhere in the codebase
