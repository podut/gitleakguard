FROM node:20-alpine

RUN apk add --no-cache git

RUN npm install -g gitleakguard@latest

WORKDIR /repo

# Default: scan staged files
# MCP server: docker run -i --rm -v $(pwd):/repo --entrypoint gitleakguard-mcp podutpetru/gitleakguard
ENTRYPOINT ["gitleakguard"]
CMD ["scan"]
