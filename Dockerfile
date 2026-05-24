FROM node:20-slim

# All system dependencies in one layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    git python3 python3-pip \
    openjdk-17-jre-headless \
    curl unzip wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# trivy — download latest binary directly
RUN curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh \
    | sh -s -- -b /usr/local/bin

# sonar-scanner CLI
ARG SONAR_VERSION=6.2.1.4610
RUN wget -qO /tmp/sonar.zip \
    "https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-${SONAR_VERSION}-linux-x64.zip" \
    && unzip -q /tmp/sonar.zip -d /opt \
    && mv /opt/sonar-scanner-${SONAR_VERSION}-linux-x64 /opt/sonar-scanner \
    && ln -sf /opt/sonar-scanner/bin/sonar-scanner /usr/local/bin/sonar-scanner \
    && rm /tmp/sonar.zip

# semgrep + njsscan (Python SAST)
RUN pip3 install --break-system-packages semgrep njsscan

# retire (npm) + local gitleakguard package
WORKDIR /app
COPY . .
RUN npm install -g retire && npm install -g .

WORKDIR /repo

# Usage:
#   scan:       docker run --rm -v $(pwd):/repo podutpetru/gitleakguard scan
#   mcp all:    docker run -i --rm -v $(pwd):/repo --entrypoint gitleakguard-mcp podutpetru/gitleakguard
#   mcp select: docker run -i --rm -v $(pwd):/repo -e ENABLED_TOOLS=trivy_scan,semgrep_scan --entrypoint gitleakguard-mcp podutpetru/gitleakguard
ENTRYPOINT ["gitleakguard"]
CMD ["scan"]
