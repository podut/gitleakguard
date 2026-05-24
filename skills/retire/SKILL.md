---
name: retire
description: Scans JavaScript dependencies for known vulnerabilities using the RetireJS database. Checks npm packages in node_modules and package.json against a database of CVEs. Use when adding new packages, reviewing dependencies, or before deploying.
---

# retire — Vulnerable Dependency Scanner

RetireJS detects JavaScript libraries with known security vulnerabilities (CVEs).

## Scan dependencies

```bash
# Install
npm install -g retire

# Scan project
retire

# Scan with verbose output
retire --verbose

# Output JSON for CI
retire --outputformat json --outputpath retire-report.json

# Check specific package
retire --package
```

## Alternatives (built into npm)

```bash
# npm audit (always available)
npm audit

# Fix automatically
npm audit fix

# Fix including breaking changes
npm audit fix --force

# Yarn
yarn audit
```

## What it detects

- CVEs in npm packages listed in `package.json` and `package-lock.json`
- Transitive dependencies (dependencies of dependencies)
- Outdated packages with known exploits
- Packages with prototype pollution vulnerabilities
- Packages with ReDoS vulnerabilities

## Automatic trigger

When the user:
- Runs `npm install <package>` → check if the package has known CVEs
- Adds a dependency to `package.json` → warn if vulnerable version
- Asks about upgrading packages → check which ones have security fixes

Say: "Checking `<package>` for known vulnerabilities..."
Then run: `npm audit` or look up the package on `npmjs.com/advisories`

## Before every deploy

```bash
npm audit --audit-level=high
# Exit code 1 if high/critical vulnerabilities found
```

## CI/CD integration

```yaml
- name: Security audit
  run: npm audit --audit-level=moderate
```

## When vulnerabilities are found

1. Show: package name, CVE ID, severity, affected versions
2. Suggest: `npm install <package>@<safe-version>`
3. If no safe version: suggest alternative package
4. Check if the vulnerability is actually exploitable in your usage context
