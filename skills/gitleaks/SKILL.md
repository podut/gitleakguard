---
name: gitleaks
description: Scans git repositories and staged files for hardcoded secrets using gitleaks. More comprehensive than basic pattern matching — uses a curated ruleset of 150+ secret types. Use before commits, pushes, or when reviewing code for credential leaks.
---

# gitleaks — Advanced Secret Scanner

Gitleaks is a fast, open-source secret scanner with 150+ built-in rules covering every major provider.

## Before every commit

Run automatically when the user mentions commit, stage, push:

```bash
# Scan staged files only
gitleaks protect --staged --verbose

# Scan entire repo
gitleaks detect --verbose
```

If gitleaks is not installed:
```bash
# macOS
brew install gitleaks

# Linux / WSL
curl -sSfL https://github.com/gitleaks/gitleaks/releases/latest/download/gitleaks_linux_x64.tar.gz | tar -xz
sudo mv gitleaks /usr/local/bin

# Windows (via scoop)
scoop install gitleaks

# Docker (no install)
docker run --rm -v "$(pwd):/repo" zricethezav/gitleaks detect --source /repo
```

## What it detects (150+ rules)

- All major cloud providers: AWS, GCP, Azure, DigitalOcean
- AI APIs: OpenAI, Anthropic, Cohere, HuggingFace
- Payment: Stripe, PayPal, Braintree, Square
- Source control: GitHub, GitLab, Bitbucket
- Messaging: Slack, Twilio, SendGrid, Mailgun
- Databases: connection strings with embedded credentials
- Private keys: RSA, EC, DSA, OpenSSH, PGP

## CI/CD integration

```yaml
# GitHub Actions
- name: Scan for secrets
  uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Custom rules

Create `.gitleaks.toml` to add company-specific patterns:
```toml
[[rules]]
id = "my-internal-token"
description = "Internal API token"
regex = '''mycompany_[a-z0-9]{32}'''
```

## When secrets are found

1. Do NOT commit or push
2. Revoke the credential immediately at the provider's dashboard
3. Move to `.env` and replace with `process.env.VAR`
4. If already pushed: rotate key + `git filter-repo --invert-paths --path <file>`
