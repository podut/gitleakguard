---
name: trivy
description: Comprehensive vulnerability scanner for containers, filesystems, git repos, and infrastructure-as-code. Finds CVEs in OS packages and language dependencies, detects misconfigurations in Dockerfiles/Kubernetes/Terraform, and scans for secrets. Use after building Docker images or before deploying.
---

# trivy — Vulnerability & Misconfiguration Scanner

Trivy is the most comprehensive open-source security scanner — covers containers, code, IaC, and secrets.

## Scan a Docker image

```bash
# Install
brew install trivy          # macOS
apt install trivy           # Linux (after adding repo)
# or use Docker:
docker run --rm aquasec/trivy image myapp:latest

# Scan local image
trivy image myapp:latest

# Scan with severity filter
trivy image --severity HIGH,CRITICAL myapp:latest

# Exit code 1 if vulnerabilities found (for CI)
trivy image --exit-code 1 --severity CRITICAL myapp:latest
```

## Scan filesystem / project

```bash
# Scan current directory (finds CVEs in package.json, requirements.txt, etc.)
trivy fs .

# Scan specific file
trivy fs package-lock.json
```

## Scan for secrets

```bash
trivy fs --scanners secret .
trivy image --scanners secret myapp:latest
```

## Scan IaC (Dockerfile, Kubernetes, Terraform)

```bash
# Scan Dockerfile for misconfigurations
trivy config Dockerfile

# Scan k8s manifests
trivy config k8s/

# Scan Terraform
trivy config main.tf
```

## What trivy detects

| Category | Examples |
|---|---|
| OS CVEs | Vulnerable Alpine/Ubuntu packages |
| Language CVEs | npm, pip, gem, cargo packages with CVEs |
| Secrets | API keys, tokens, private keys in image layers |
| Misconfigs | Running as root, no USER, exposed secrets in ENV |
| SBOM | Software Bill of Materials |

## Automatic trigger

When user builds, pushes, or deploys a Docker image:
1. Say: "Scanning image for vulnerabilities..."
2. Suggest: `trivy image <image-name>`
3. If CRITICAL CVEs found → block deploy, show affected packages
4. If only LOW/MEDIUM → warn but allow

## CI/CD integration

```yaml
- name: Trivy vulnerability scan
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: myapp:latest
    severity: HIGH,CRITICAL
    exit-code: 1

- name: Trivy IaC scan
  uses: aquasecurity/trivy-action@master
  with:
    scan-type: config
    scan-ref: .
```

## When vulnerabilities are found

1. Show: CVE ID, package, installed version, fixed version, severity
2. Fix: update the base image or the vulnerable package
3. For OS packages: use a newer base image tag
4. For language deps: `npm install <package>@<safe-version>`
5. Rebuild and re-scan to confirm fix
