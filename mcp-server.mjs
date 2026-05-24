#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { execSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const PATTERNS = [
  { name: "AWS Access Key",     regex: /AKIA[0-9A-Z]{16}/g },
  { name: "GitHub Token",       regex: /ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82}/g },
  { name: "OpenAI API Key",     regex: /sk-[A-Za-z0-9]{48}|sk-proj-[A-Za-z0-9_-]{40,}/g },
  { name: "Anthropic API Key",  regex: /sk-ant-api\d{2}-[A-Za-z0-9_-]{40,}/g },
  { name: "Google API Key",     regex: /AIza[0-9A-Za-z_-]{35}/g },
  { name: "Stripe Live Key",    regex: /sk_live_[A-Za-z0-9]{24,}/g },
  { name: "Stripe Test Key",    regex: /sk_test_[A-Za-z0-9]{24,}/g },
  { name: "Slack Bot Token",    regex: /xoxb-[0-9]{11,13}-[0-9]{11,13}-[a-zA-Z0-9]{24}/g },
  { name: "Firebase Key",       regex: /AAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140}/g },
  { name: "Private Key Block",  regex: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
  { name: "JWT Token",          regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { name: "Credentials in URL", regex: /[a-z][a-z0-9+.-]*:\/\/[^:@\s/]+:[^@\s]{3,}@[^\s]+/g },
  { name: "Generic Secret Var", regex: /(?:secret|password|passwd|api_key|apikey|auth_token|access_token)\s*[=:]\s*['"][^'"]{8,}['"]/gi },
];

const IGNORE = [
  /node_modules\//,
  /\.git\//,
  /dist\//,
  /build\//,
  /\.svelte-kit\//,
  /\.env\.example$/,
  /\.env\.template$/,
  /\.env\.sample$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /\.min\.js$/,
];

function ignored(p) { return IGNORE.some(r => r.test(p.replace(/\\/g, "/"))); }

function scanContent(content, filePath) {
  const findings = [];
  const lines = content.split("\n");
  for (const { name, regex } of PATTERNS) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const lineNumber = content.slice(0, match.index).split("\n").length;
      const lineContent = lines[lineNumber - 1]?.trim() ?? "";
      findings.push({
        rule: name,
        file: filePath,
        line: lineNumber,
        preview: lineContent.length > 100 ? lineContent.slice(0, 97) + "..." : lineContent,
      });
    }
  }
  return findings;
}

function walkDir(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (ignored(full)) continue;
    if (e.isDirectory()) walkDir(full, out);
    else out.push(full);
  }
  return out;
}

function formatFindings(findings, title) {
  let s = `✖ ${title} — ${findings.length} secret(s) found:\n\n`;
  for (const f of findings) {
    s += `  ● ${f.rule}\n    File: ${f.file}:${f.line}\n    Line: ${f.preview}\n\n`;
  }
  s += `How to fix:\n`;
  s += `  1. Move the secret to .env\n`;
  s += `  2. Ensure .env is in .gitignore\n`;
  s += `  3. Replace in code with process.env.YOUR_KEY\n`;
  s += `  4. Revoke and rotate the exposed credential immediately`;
  return s;
}

// --- MCP Server ---

const server = new Server(
  { name: "gitleakguard", version: "1.0.2" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "scan_staged",
      description: "Scan git staged files for hardcoded secrets. Run before every commit.",
      inputSchema: {
        type: "object",
        properties: {
          cwd: { type: "string", description: "Git repository path (default: current working directory)" }
        }
      }
    },
    {
      name: "scan_file",
      description: "Scan a specific file for hardcoded secrets, API keys, or credentials.",
      inputSchema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "Absolute or relative path to the file" }
        },
        required: ["file_path"]
      }
    },
    {
      name: "scan_directory",
      description: "Scan all files in a directory recursively for hardcoded secrets.",
      inputSchema: {
        type: "object",
        properties: {
          dir_path: { type: "string", description: "Directory path to scan" }
        },
        required: ["dir_path"]
      }
    },
    {
      name: "scan_history",
      description: "Scan git commit history for secrets that may have been committed in the past.",
      inputSchema: {
        type: "object",
        properties: {
          cwd: { type: "string", description: "Git repository path" },
          depth: { type: "number", description: "Number of commits to scan (default: 50)" }
        }
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // --- scan_staged ---
  if (name === "scan_staged") {
    const cwd = args?.cwd ? resolve(args.cwd) : process.cwd();
    let staged;
    try {
      staged = execSync("git diff --cached --name-only --diff-filter=ACM", {
        cwd, encoding: "utf8", stdio: "pipe"
      }).trim().split("\n").filter(Boolean);
    } catch {
      return { content: [{ type: "text", text: "Error: Not a git repository or git not available." }] };
    }
    if (staged.length === 0) {
      return { content: [{ type: "text", text: "✓ No staged files to scan." }] };
    }
    const findings = [];
    for (const file of staged) {
      if (ignored(file)) continue;
      let content;
      try { content = execSync(`git show :${file}`, { cwd, encoding: "utf8", stdio: "pipe" }); }
      catch { continue; }
      findings.push(...scanContent(content, file));
    }
    if (findings.length === 0) {
      return { content: [{ type: "text", text: `✓ Scanned ${staged.length} staged file(s) — no secrets detected. Safe to commit.` }] };
    }
    return { content: [{ type: "text", text: formatFindings(findings, "COMMIT BLOCKED") }] };
  }

  // --- scan_file ---
  if (name === "scan_file") {
    const filePath = resolve(args.file_path);
    if (!existsSync(filePath)) {
      return { content: [{ type: "text", text: `Error: File not found: ${filePath}` }] };
    }
    let content;
    try { content = readFileSync(filePath, "utf8"); }
    catch (e) { return { content: [{ type: "text", text: `Error reading file: ${e.message}` }] }; }
    const findings = scanContent(content, args.file_path);
    if (findings.length === 0) {
      return { content: [{ type: "text", text: `✓ No secrets detected in ${args.file_path}` }] };
    }
    return { content: [{ type: "text", text: formatFindings(findings, "SECRETS FOUND") }] };
  }

  // --- scan_directory ---
  if (name === "scan_directory") {
    const dirPath = resolve(args.dir_path);
    const files = walkDir(dirPath);
    const findings = [];
    for (const file of files) {
      let content;
      try { content = readFileSync(file, "utf8"); }
      catch { continue; }
      findings.push(...scanContent(content, file));
    }
    if (findings.length === 0) {
      return { content: [{ type: "text", text: `✓ Scanned ${files.length} file(s) in ${args.dir_path} — no secrets detected.` }] };
    }
    return { content: [{ type: "text", text: formatFindings(findings, `SECRETS FOUND IN ${args.dir_path}`) }] };
  }

  // --- scan_history ---
  if (name === "scan_history") {
    const cwd = args?.cwd ? resolve(args.cwd) : process.cwd();
    const depth = args?.depth ?? 50;
    let commits;
    try {
      commits = execSync(`git log --oneline -${depth}`, { cwd, encoding: "utf8" })
        .trim().split("\n").filter(Boolean);
    } catch {
      return { content: [{ type: "text", text: "Error: Not a git repository." }] };
    }
    const findings = [];
    for (const line of commits) {
      const hash = line.split(" ")[0];
      let diff;
      try { diff = execSync(`git show ${hash}`, { cwd, encoding: "utf8", stdio: "pipe" }); }
      catch { continue; }
      findings.push(...scanContent(diff, `commit:${hash}`));
    }
    if (findings.length === 0) {
      return { content: [{ type: "text", text: `✓ Scanned ${commits.length} commits — no secrets found in history.` }] };
    }
    const report = formatFindings(findings, `SECRETS IN GIT HISTORY (last ${commits.length} commits)`);
    return { content: [{ type: "text", text: report + "\n\n⚠ Credentials in history are COMPROMISED. Rotate them immediately.\nRewrite history: npx git-filter-repo or BFG Repo Cleaner" }] };
  }

  return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
