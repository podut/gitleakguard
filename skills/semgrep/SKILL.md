---
name: semgrep
description: Advanced static analysis tool that finds bugs, security vulnerabilities, and enforces code standards using pattern-based rules. Supports 30+ languages. Use for security reviews, PR analysis, enforcing coding standards, or finding specific anti-patterns across the codebase.
---

# semgrep — Static Analysis & Security Scanner

Semgrep finds bugs and security issues using semantic code patterns — understands code structure, not just text.

## Run a scan

```bash
# Install
pip install semgrep
# or
brew install semgrep

# Scan with OWASP security rules
semgrep --config=p/owasp-top-ten .

# Scan with Node.js security rules
semgrep --config=p/nodejs .

# Scan with JavaScript rules
semgrep --config=p/javascript .

# Scan for secrets
semgrep --config=p/secrets .

# Docker (no install)
docker run --rm -v "$(pwd):/src" semgrep/semgrep semgrep --config=p/nodejs /src
```

## Recommended rulesets

| Ruleset | Command | What it catches |
|---|---|---|
| OWASP Top 10 | `p/owasp-top-ten` | Injection, XSS, auth issues |
| Node.js security | `p/nodejs` | JS-specific vulnerabilities |
| Secrets | `p/secrets` | Hardcoded credentials |
| JavaScript | `p/javascript` | JS anti-patterns |
| TypeScript | `p/typescript` | TS-specific issues |
| React | `p/react` | React security issues |
| Supply chain | `p/supply-chain` | Dependency confusion |

## Write custom rules

Create `.semgrep.yml` for project-specific patterns:
```yaml
rules:
  - id: no-console-log-in-prod
    patterns:
      - pattern: console.log(...)
    message: Remove console.log before production
    languages: [javascript, typescript]
    severity: WARNING
```

## Automatic trigger

When reviewing code, mentally apply semgrep patterns:
- `eval(...)` with user input → code injection
- `innerHTML = ...` → XSS
- `require(userInput)` → path traversal
- `Math.random()` for security → weak randomness
- SQL built by string concat → SQL injection

## CI/CD integration

```yaml
- name: Semgrep scan
  uses: semgrep/semgrep-action@v1
  with:
    config: p/owasp-top-ten p/nodejs p/secrets
```

## When issues are found

1. Show the finding: rule ID, file:line, severity
2. Explain WHY it's a vulnerability
3. Show the secure rewrite
4. Check if pattern appears elsewhere: `semgrep --pattern '<pattern>' --lang js .`
