---
name: zap
description: OWASP ZAP (Zed Attack Proxy) — dynamic application security testing (DAST). Scans running web apps for XSS, SQL injection, CSRF, and 100+ other vulnerabilities. Use before deploying to staging or production.
---

# zap — OWASP ZAP Dynamic Scanner

ZAP actively attacks a running web application to find real exploitable vulnerabilities, unlike SAST tools that only read source code.

## Start ZAP daemon

```bash
# Docker (recommended)
docker run -d --name zap \
  -p 8080:8080 \
  ghcr.io/zaproxy/zaproxy:stable \
  zap.sh -daemon -port 8080 -host 0.0.0.0 \
  -config api.key=zap-api-key-here \
  -config api.addrs.addr.name=.* \
  -config api.addrs.addr.regex=true

# ZAP is now accessible at http://localhost:8080
```

## Run a scan

```bash
# Quick baseline scan (passive only, safe for prod-like envs)
docker run --rm ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t https://myapp.example.com -r report.html

# Full active scan (aggressive, use only on test envs)
docker run --rm ghcr.io/zaproxy/zaproxy:stable \
  zap-full-scan.py -t https://myapp.example.com -r report.html

# API scan (OpenAPI/Swagger)
docker run --rm ghcr.io/zaproxy/zaproxy:stable \
  zap-api-scan.py -t https://myapp.example.com/openapi.json -f openapi -r report.html
```

## Scan via API (when daemon is running)

```bash
ZAP_URL=http://localhost:8080
API_KEY=zap-api-key-here
TARGET=http://localhost:3000

# Spider (crawl)
curl "$ZAP_URL/JSON/spider/action/scan/?url=$TARGET&apikey=$API_KEY"

# Active scan
curl "$ZAP_URL/JSON/ascan/action/scan/?url=$TARGET&recurse=true&apikey=$API_KEY"

# Get alerts
curl "$ZAP_URL/JSON/alert/view/alerts/?apikey=$API_KEY" | jq '.alerts[] | select(.risk == "High")'

# Generate HTML report
curl "$ZAP_URL/OTHER/core/other/htmlreport/?apikey=$API_KEY" -o zap-report.html
```

## What ZAP detects

| Risk | Examples |
|---|---|
| High | SQL Injection, XSS, Path Traversal, RCE |
| Medium | CSRF, X-Frame-Options missing, Insecure cookies |
| Low | Server version disclosure, Cache-Control issues |
| Informational | User enumeration hints, debug endpoints |

## MCP tools available (gitleakguard MCP server)

- `zap_scan` — trigger spider + active scan on a target URL
- `zap_alerts` — get all alerts, filtered by risk level
- `zap_start_info` — show docker command to start ZAP daemon

## Automatic trigger

When user mentions ZAP, DAST, web scan, pentest, security test, or "scan the app":
1. Check if ZAP daemon is running at `http://localhost:8080`
2. If running → use MCP tool `zap_scan` or `zap_alerts`
3. If not running → show docker start command
4. HIGH/CRITICAL alerts → warn before deploy, list affected endpoints
5. Always clarify: only scan apps you own or have written permission to test

## CI/CD integration

```yaml
# GitHub Actions — baseline scan
- name: ZAP Baseline Scan
  uses: zaproxy/action-baseline@v0.12.0
  with:
    target: 'https://staging.myapp.com'
    rules_file_name: '.zap/rules.tsv'
    cmd_options: '-a'

# Full scan (staging only)
- name: ZAP Full Scan
  uses: zaproxy/action-full-scan@v0.10.0
  with:
    target: 'https://staging.myapp.com'
```

## Install MCP tool

```bash
gitleakguard mcp setup
```

Then in Claude Code: use `zap_scan` and `zap_alerts` directly.
