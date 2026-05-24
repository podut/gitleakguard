---
name: sonarqube
description: Static code analysis with SonarQube/SonarCloud. Detects bugs, code smells, security hotspots, and checks quality gate status. Use before merging PRs or deploying to production.
---

# sonarqube — Static Code Analysis

SonarQube finds bugs, vulnerabilities, and code smells through deep static analysis. Integrates with CI/CD to block deploys when quality gate fails.

## Run analysis

```bash
# Install sonar-scanner
npm install -g sonar-scanner

# Scan current project (SonarCloud)
sonar-scanner \
  -Dsonar.projectKey=my-project \
  -Dsonar.organization=my-org \
  -Dsonar.sources=src \
  -Dsonar.host.url=https://sonarcloud.io \
  -Dsonar.token=$SONAR_TOKEN

# Scan with Docker (self-hosted)
docker run --rm \
  -e SONAR_HOST_URL=http://localhost:9000 \
  -e SONAR_TOKEN=$SONAR_TOKEN \
  -v "$(pwd):/usr/src" \
  sonarsource/sonar-scanner-cli
```

## Start SonarQube locally

```bash
docker run -d --name sonarqube \
  -p 9000:9000 \
  sonarqube:community

# Default login: admin / admin
# Access: http://localhost:9000
```

## Check quality gate via API

```bash
# Get quality gate status
curl -u $SONAR_TOKEN: \
  "https://sonarcloud.io/api/qualitygates/project_status?projectKey=my-project"

# Get issues (CRITICAL + BLOCKER)
curl -u $SONAR_TOKEN: \
  "https://sonarcloud.io/api/issues/search?componentKeys=my-project&severities=CRITICAL,BLOCKER&resolved=false"
```

## sonar-project.properties

```properties
sonar.projectKey=my-project
sonar.projectName=My Project
sonar.sources=src
sonar.exclusions=**/node_modules/**,**/dist/**,**/*.test.ts
sonar.javascript.lcov.reportPaths=coverage/lcov.info
```

## What SonarQube detects

| Category | Examples |
|---|---|
| Bugs | Null dereferences, resource leaks, incorrect comparisons |
| Vulnerabilities | SQL injection, XSS, hardcoded credentials |
| Security Hotspots | Crypto usage, auth logic, input validation |
| Code Smells | Complexity, duplication, dead code |

## MCP tools available (gitleakguard MCP server)

- `sonarqube_issues` — fetch open issues from SonarQube/SonarCloud API
- `sonarqube_quality_gate` — check if quality gate is passing or failing
- `sonarqube_scan` — run sonar-scanner CLI if installed

## Automatic trigger

When user mentions SonarQube, code quality, quality gate, or asks to review code before merge:
1. Check if `sonar-project.properties` exists
2. If yes: suggest `sonar-scanner` or use MCP tool `sonarqube_quality_gate`
3. If quality gate FAILED → list blocking issues, suggest fixes
4. If CRITICAL/BLOCKER issues → warn before deploy

## CI/CD integration

```yaml
# GitHub Actions
- name: SonarCloud Scan
  uses: SonarSource/sonarcloud-github-action@master
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

## Install MCP tool

```bash
gitleakguard mcp setup
```

Then in Claude Code: use `sonarqube_issues` or `sonarqube_quality_gate` directly.
