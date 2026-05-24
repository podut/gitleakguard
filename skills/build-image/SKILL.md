---
name: build-image
description: Builds Docker images, validates Dockerfiles for best practices, scans built images for vulnerabilities, and pushes to registries. Use before deploying containerized applications or when making changes to Dockerfiles.
---

# build-image — Docker Image Builder & Validator

Builds, validates, and scans Docker images before deployment.

## Build workflow

```bash
# Basic build
docker build -t myapp:latest .

# Build with version tag
docker build -t myapp:1.0.0 -t myapp:latest .

# Build for multiple platforms (CI/CD)
docker buildx build --platform linux/amd64,linux/arm64 -t myapp:latest .

# Build with build args (never pass secrets as build args)
docker build --build-arg NODE_ENV=production -t myapp:latest .
```

## Validate Dockerfile before building

Check for common issues:
- `COPY . .` before `RUN npm install` → invalidates cache on every change
- Secrets passed as `ENV` or `ARG` → visible in image layers
- Running as root → security risk, use `USER node`
- No `.dockerignore` → copies `node_modules`, `.env`, `.git`
- `latest` tag for base image → not reproducible

## Required .dockerignore

Always ensure `.dockerignore` exists with:
```
node_modules
.env
.env.*
.git
*.log
dist
coverage
```

## Security: never pass secrets in Dockerfile

```dockerfile
# NEVER do this — secret visible in image layers:
ENV DATABASE_URL=postgresql://user:pass@host/db
ARG API_KEY=sk-real-key

# DO this instead — pass at runtime:
# docker run -e DATABASE_URL=$DATABASE_URL myapp
```

## Scan built image for vulnerabilities

```bash
# With trivy (after build)
trivy image myapp:latest

# With docker scout
docker scout cves myapp:latest
```

## Push to registry

```bash
# Docker Hub
docker push myapp:latest

# GitHub Container Registry
docker tag myapp:latest ghcr.io/username/myapp:latest
docker push ghcr.io/username/myapp:latest

# AWS ECR
aws ecr get-login-password | docker login --username AWS --password-stdin <ecr-url>
docker push <ecr-url>/myapp:latest
```

## CI/CD integration

```yaml
- name: Build and push
  uses: docker/build-push-action@v5
  with:
    push: true
    tags: myapp:latest
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

## Automatic trigger

When user mentions: build image, docker build, deploy container, push image:
1. Check if `Dockerfile` exists
2. Check if `.dockerignore` exists — create if missing
3. Warn about any secrets in Dockerfile
4. Suggest the build command with proper tagging
5. Remind to scan the image after build
