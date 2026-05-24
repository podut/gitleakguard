#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { execSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";

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

// --- HTTP helpers ---

function apiGet(url, token) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === "https:";
    const fn = isHttps ? httpsRequest : httpRequest;
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: token ? { Authorization: "Basic " + Buffer.from(token + ":").toString("base64") } : {},
      rejectUnauthorized: false,
    };
    const req = fn(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data, status: res.statusCode }); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function apiPost(url, token, params = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const qs = new URLSearchParams(params).toString();
    const isHttps = parsed.protocol === "https:";
    const fn = isHttps ? httpsRequest : httpRequest;
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + (qs ? "?" + qs : ""),
      method: "POST",
      headers: {
        "Content-Length": 0,
        ...(token ? { Authorization: "Basic " + Buffer.from(token + ":").toString("base64") } : {}),
      },
      rejectUnauthorized: false,
    };
    const req = fn(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data, status: res.statusCode }); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

// --- MCP Server ---

const server = new Server(
  { name: "gitleakguard", version: "1.2.0" },
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
    },
    {
      name: "sonarqube_issues",
      description: "Fetch open issues from SonarQube or SonarCloud REST API.",
      inputSchema: {
        type: "object",
        properties: {
          project_key: { type: "string", description: "SonarQube project key" },
          host_url: { type: "string", description: "SonarQube URL (default: https://sonarcloud.io)" },
          token: { type: "string", description: "SonarQube token (or set SONAR_TOKEN env var)" },
          severities: { type: "string", description: "Comma-separated: BLOCKER,CRITICAL,MAJOR,MINOR,INFO (default: BLOCKER,CRITICAL)" }
        },
        required: ["project_key"]
      }
    },
    {
      name: "sonarqube_quality_gate",
      description: "Check if the SonarQube quality gate is passing or failing for a project.",
      inputSchema: {
        type: "object",
        properties: {
          project_key: { type: "string", description: "SonarQube project key" },
          host_url: { type: "string", description: "SonarQube URL (default: https://sonarcloud.io)" },
          token: { type: "string", description: "SonarQube token (or set SONAR_TOKEN env var)" }
        },
        required: ["project_key"]
      }
    },
    {
      name: "sonarqube_scan",
      description: "Run sonar-scanner CLI on a local project directory.",
      inputSchema: {
        type: "object",
        properties: {
          dir_path: { type: "string", description: "Project directory to scan (default: current directory)" },
          project_key: { type: "string", description: "Project key (reads sonar-project.properties if omitted)" },
          host_url: { type: "string", description: "SonarQube host URL" },
          token: { type: "string", description: "SonarQube token" }
        }
      }
    },
    {
      name: "zap_scan",
      description: "Trigger OWASP ZAP spider + active scan on a target URL. ZAP daemon must be running.",
      inputSchema: {
        type: "object",
        properties: {
          target_url: { type: "string", description: "URL to scan (e.g. http://localhost:3000)" },
          zap_url: { type: "string", description: "ZAP daemon URL (default: http://localhost:8080)" },
          api_key: { type: "string", description: "ZAP API key (or set ZAP_API_KEY env var)" }
        },
        required: ["target_url"]
      }
    },
    {
      name: "zap_alerts",
      description: "Get security alerts from OWASP ZAP after a scan.",
      inputSchema: {
        type: "object",
        properties: {
          zap_url: { type: "string", description: "ZAP daemon URL (default: http://localhost:8080)" },
          api_key: { type: "string", description: "ZAP API key (or set ZAP_API_KEY env var)" },
          risk: { type: "string", description: "Minimum risk level: High, Medium, Low, Informational (default: High)" }
        }
      }
    },
    {
      name: "zap_start_info",
      description: "Show the Docker command to start OWASP ZAP daemon and verify if it's already running.",
      inputSchema: {
        type: "object",
        properties: {
          api_key: { type: "string", description: "API key to use (default: zap-api-key)" }
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

  // --- sonarqube_issues ---
  if (name === "sonarqube_issues") {
    const host = args.host_url || "https://sonarcloud.io";
    const token = args.token || process.env.SONAR_TOKEN;
    const severities = args.severities || "BLOCKER,CRITICAL";
    if (!token) return { content: [{ type: "text", text: "Error: SonarQube token required. Pass 'token' argument or set SONAR_TOKEN env var." }] };
    try {
      const url = `${host}/api/issues/search?componentKeys=${encodeURIComponent(args.project_key)}&severities=${severities}&resolved=false&ps=50`;
      const data = await apiGet(url, token);
      if (data.errors) return { content: [{ type: "text", text: `SonarQube error: ${data.errors.map(e => e.msg).join(", ")}` }] };
      const issues = data.issues || [];
      if (issues.length === 0) return { content: [{ type: "text", text: `✓ No open ${severities} issues in ${args.project_key}` }] };
      let out = `✖ ${issues.length} issue(s) found in ${args.project_key} [${severities}]:\n\n`;
      for (const i of issues.slice(0, 20)) {
        out += `  ● [${i.severity}] ${i.message}\n    ${i.component}:${i.line || "?"}\n    Rule: ${i.rule}\n\n`;
      }
      if (issues.length > 20) out += `  ... and ${issues.length - 20} more. See ${host}/project/issues?id=${args.project_key}\n`;
      return { content: [{ type: "text", text: out }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error connecting to SonarQube at ${host}: ${e.message}` }] };
    }
  }

  // --- sonarqube_quality_gate ---
  if (name === "sonarqube_quality_gate") {
    const host = args.host_url || "https://sonarcloud.io";
    const token = args.token || process.env.SONAR_TOKEN;
    if (!token) return { content: [{ type: "text", text: "Error: SonarQube token required. Pass 'token' argument or set SONAR_TOKEN env var." }] };
    try {
      const url = `${host}/api/qualitygates/project_status?projectKey=${encodeURIComponent(args.project_key)}`;
      const data = await apiGet(url, token);
      if (data.errors) return { content: [{ type: "text", text: `SonarQube error: ${data.errors.map(e => e.msg).join(", ")}` }] };
      const status = data.projectStatus?.status;
      const conditions = data.projectStatus?.conditions || [];
      if (status === "OK") return { content: [{ type: "text", text: `✓ Quality gate PASSED for ${args.project_key}` }] };
      let out = `✖ Quality gate FAILED for ${args.project_key}\n\nFailing conditions:\n`;
      for (const c of conditions.filter(c => c.status === "ERROR")) {
        out += `  ● ${c.metricKey}: actual=${c.actualValue} (threshold: ${c.errorThreshold})\n`;
      }
      out += `\nFix issues at: ${host}/project/issues?id=${args.project_key}`;
      return { content: [{ type: "text", text: out }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error connecting to SonarQube at ${host}: ${e.message}` }] };
    }
  }

  // --- sonarqube_scan ---
  if (name === "sonarqube_scan") {
    const dir = args.dir_path ? resolve(args.dir_path) : process.cwd();
    let scannerAvailable = false;
    try { execSync("sonar-scanner --version", { stdio: "pipe" }); scannerAvailable = true; } catch {}
    if (!scannerAvailable) {
      return { content: [{ type: "text", text: "sonar-scanner not found. Install it:\n  npm install -g sonar-scanner\n\nOr use Docker:\n  docker run --rm -e SONAR_TOKEN=$SONAR_TOKEN -e SONAR_HOST_URL=https://sonarcloud.io -v \"" + dir + ":/usr/src\" sonarsource/sonar-scanner-cli" }] };
    }
    const token = args.token || process.env.SONAR_TOKEN;
    let cmd = `sonar-scanner`;
    if (args.project_key) cmd += ` -Dsonar.projectKey=${args.project_key}`;
    if (args.host_url) cmd += ` -Dsonar.host.url=${args.host_url}`;
    if (token) cmd += ` -Dsonar.token=${token}`;
    try {
      const out = execSync(cmd, { cwd: dir, encoding: "utf8", stdio: "pipe", timeout: 120000 });
      const passed = out.includes("ANALYSIS SUCCESSFUL") || out.includes("EXECUTION SUCCESS");
      return { content: [{ type: "text", text: passed ? `✓ SonarQube analysis complete.\n${out.slice(-500)}` : out.slice(-1000) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `sonar-scanner failed:\n${e.stderr || e.message}` }] };
    }
  }

  // --- zap_start_info ---
  if (name === "zap_start_info") {
    const key = args.api_key || "zap-api-key";
    let running = false;
    try { await apiGet("http://localhost:8080/JSON/core/view/version/?apikey=" + key, null); running = true; } catch {}
    const dockerCmd = `docker run -d --name zap \\
  -p 8080:8080 \\
  ghcr.io/zaproxy/zaproxy:stable \\
  zap.sh -daemon -port 8080 -host 0.0.0.0 \\
  -config api.key=${key} \\
  -config api.addrs.addr.name=.* \\
  -config api.addrs.addr.regex=true`;
    if (running) {
      return { content: [{ type: "text", text: `✓ ZAP daemon is already running at http://localhost:8080\n\nAPI key in use: ${key}\nStart command (for reference):\n${dockerCmd}` }] };
    }
    return { content: [{ type: "text", text: `ZAP daemon is NOT running. Start it with:\n\n${dockerCmd}\n\nThen use zap_scan or zap_alerts.` }] };
  }

  // --- zap_scan ---
  if (name === "zap_scan") {
    const zapUrl = args.zap_url || "http://localhost:8080";
    const key = args.api_key || process.env.ZAP_API_KEY || "zap-api-key";
    const target = args.target_url;
    try {
      await apiGet(`${zapUrl}/JSON/core/view/version/?apikey=${key}`, null);
    } catch {
      return { content: [{ type: "text", text: `ZAP daemon not reachable at ${zapUrl}. Use zap_start_info to get the start command.` }] };
    }
    try {
      const spider = await apiPost(`${zapUrl}/JSON/spider/action/scan/`, null, { url: target, apikey: key, recurse: "true" });
      const scanId = spider.scan;
      let progress = 0;
      while (progress < 100) {
        await new Promise(r => setTimeout(r, 2000));
        const s = await apiGet(`${zapUrl}/JSON/spider/view/status/?scanId=${scanId}&apikey=${key}`, null);
        progress = parseInt(s.status || "100");
      }
      const ascan = await apiPost(`${zapUrl}/JSON/ascan/action/scan/`, null, { url: target, recurse: "true", apikey: key });
      return { content: [{ type: "text", text: `✓ Spider complete. Active scan started (ID: ${ascan.scan}).\n\nUse zap_alerts to get results once scan finishes.\nMonitor: ${zapUrl}/JSON/ascan/view/status/?scanId=${ascan.scan}&apikey=${key}` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `ZAP scan error: ${e.message}` }] };
    }
  }

  // --- zap_alerts ---
  if (name === "zap_alerts") {
    const zapUrl = args.zap_url || "http://localhost:8080";
    const key = args.api_key || process.env.ZAP_API_KEY || "zap-api-key";
    const riskFilter = (args.risk || "High").toLowerCase();
    const riskOrder = { high: 3, medium: 2, low: 1, informational: 0 };
    const minRisk = riskOrder[riskFilter] ?? 3;
    try {
      const data = await apiGet(`${zapUrl}/JSON/alert/view/alerts/?apikey=${key}`, null);
      const all = data.alerts || [];
      const filtered = all.filter(a => (riskOrder[a.risk?.toLowerCase()] ?? 0) >= minRisk);
      if (filtered.length === 0) {
        return { content: [{ type: "text", text: `✓ No ${args.risk || "High"} or above alerts found. Total alerts: ${all.length}` }] };
      }
      let out = `✖ ${filtered.length} alert(s) at risk level ${args.risk || "High"}+:\n\n`;
      for (const a of filtered.slice(0, 15)) {
        out += `  ● [${a.risk}] ${a.alert}\n    URL: ${a.url}\n    ${a.description?.slice(0, 120) || ""}\n    Solution: ${a.solution?.slice(0, 100) || "See ZAP report"}\n\n`;
      }
      if (filtered.length > 15) out += `  ... and ${filtered.length - 15} more.\n`;
      out += `\nFull report: ${zapUrl}/OTHER/core/other/htmlreport/?apikey=${key}`;
      return { content: [{ type: "text", text: out }] };
    } catch (e) {
      return { content: [{ type: "text", text: `ZAP not reachable at ${zapUrl}: ${e.message}\nUse zap_start_info to start ZAP daemon.` }] };
    }
  }

  return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
