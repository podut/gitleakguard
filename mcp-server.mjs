#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { execSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";

// ENABLED_TOOLS=trivy_scan,semgrep_scan  → expose only those tools
// unset or empty → expose all tools
const ENABLED = process.env.ENABLED_TOOLS
  ? new Set(process.env.ENABLED_TOOLS.split(",").map(t => t.trim()).filter(Boolean))
  : null;

// ─── Secret patterns ──────────────────────────────────────────────────────────

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
  /node_modules\//, /\.git\//, /dist\//, /build\//, /\.svelte-kit\//,
  /\.env\.example$/, /\.env\.template$/, /\.env\.sample$/,
  /package-lock\.json$/, /yarn\.lock$/, /\.min\.js$/,
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
      findings.push({ rule: name, file: filePath, line: lineNumber,
        preview: lineContent.length > 100 ? lineContent.slice(0, 97) + "..." : lineContent });
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
  for (const f of findings)
    s += `  ● ${f.rule}\n    File: ${f.file}:${f.line}\n    Line: ${f.preview}\n\n`;
  return s + `How to fix:\n  1. Move the secret to .env\n  2. Ensure .env is in .gitignore\n  3. Replace in code with process.env.YOUR_KEY\n  4. Revoke and rotate the exposed credential immediately`;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function apiGet(url, token) {
  return new Promise((resolve, reject) => {
    const p = new URL(url);
    const isHttps = p.protocol === "https:";
    const opts = {
      hostname: p.hostname, port: p.port || (isHttps ? 443 : 80),
      path: p.pathname + p.search, method: "GET",
      headers: token ? { Authorization: "Basic " + Buffer.from(token + ":").toString("base64") } : {},
      rejectUnauthorized: false,
    };
    const req = (isHttps ? httpsRequest : httpRequest)(opts, (res) => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d, status: res.statusCode }); } });
    });
    req.on("error", reject); req.end();
  });
}

function apiPost(url, token, params = {}) {
  return new Promise((resolve, reject) => {
    const p = new URL(url);
    const qs = new URLSearchParams(params).toString();
    const isHttps = p.protocol === "https:";
    const opts = {
      hostname: p.hostname, port: p.port || (isHttps ? 443 : 80),
      path: p.pathname + (qs ? "?" + qs : ""), method: "POST",
      headers: { "Content-Length": 0, ...(token ? { Authorization: "Basic " + Buffer.from(token + ":").toString("base64") } : {}) },
      rejectUnauthorized: false,
    };
    const req = (isHttps ? httpsRequest : httpRequest)(opts, (res) => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d, status: res.statusCode }); } });
    });
    req.on("error", reject); req.end();
  });
}

function runTool(cmd, opts = {}) {
  try {
    return { ok: true, out: execSync(cmd, { encoding: "utf8", stdio: "pipe", timeout: 120000, ...opts }) };
  } catch (e) {
    return { ok: false, out: e.stdout || "", err: e.stderr || e.message };
  }
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

function t(name, description, properties = {}, required = []) {
  return { name, description, inputSchema: { type: "object", properties, ...(required.length ? { required } : {}) } };
}

const ALL_TOOLS = [
  // secrets
  t("scan_staged",            "Scan git staged files for hardcoded secrets before commit.",                   { cwd: { type:"string", description:"Git repo path (default: cwd)" } }),
  t("scan_file",              "Scan a specific file for hardcoded secrets, API keys, or credentials.",        { file_path: { type:"string" } }, ["file_path"]),
  t("scan_directory",         "Scan all files in a directory recursively for hardcoded secrets.",             { dir_path: { type:"string" } }, ["dir_path"]),
  t("scan_history",           "Scan git commit history for secrets that may have been committed.",            { cwd: { type:"string" }, depth: { type:"number", description:"Commits to scan (default: 50)" } }),
  // sonarqube
  t("sonarqube_scan",         "Run sonar-scanner CLI on a local project directory.",                          { dir_path:{type:"string"}, project_key:{type:"string"}, host_url:{type:"string"}, token:{type:"string"} }),
  t("sonarqube_issues",       "Fetch open issues from SonarQube or SonarCloud REST API.",                     { project_key:{type:"string"}, host_url:{type:"string"}, token:{type:"string"}, severities:{type:"string",description:"BLOCKER,CRITICAL,MAJOR,MINOR,INFO"} }, ["project_key"]),
  t("sonarqube_quality_gate", "Check if the SonarQube quality gate is passing or failing.",                   { project_key:{type:"string"}, host_url:{type:"string"}, token:{type:"string"} }, ["project_key"]),
  // trivy
  t("trivy_scan",             "Run Trivy vulnerability & misconfiguration scanner on a directory or Dockerfile.", { target:{type:"string",description:"Path to scan (default: /repo)"}, type:{type:"string",description:"fs | config | image (default: fs)"}, severity:{type:"string",description:"CRITICAL,HIGH,MEDIUM,LOW (default: HIGH,CRITICAL)"} }),
  // semgrep
  t("semgrep_scan",           "Run Semgrep static analysis with OWASP security rules.",                      { dir_path:{type:"string",description:"Directory (default: /repo)"}, config:{type:"string",description:"Semgrep config (default: p/security-audit)"} }),
  // njsscan
  t("njsscan_scan",           "Run njsscan SAST on Node.js/JavaScript/TypeScript files.",                    { dir_path:{type:"string",description:"Directory (default: /repo)"} }),
  // retire
  t("retire_scan",            "Scan npm dependencies for known CVEs using RetireJS database.",               { dir_path:{type:"string",description:"Project directory (default: /repo)"} }),
  // zap
  t("zap_start_info",         "Show Docker command to start OWASP ZAP daemon and verify if already running.", { api_key:{type:"string"} }),
  t("zap_scan",               "Trigger OWASP ZAP spider + active scan on a target URL.",                     { target_url:{type:"string"}, zap_url:{type:"string",description:"ZAP URL (default: http://localhost:8080)"}, api_key:{type:"string"} }, ["target_url"]),
  t("zap_alerts",             "Get OWASP ZAP security alerts filtered by risk level.",                       { zap_url:{type:"string"}, api_key:{type:"string"}, risk:{type:"string",description:"High | Medium | Low | Informational (default: High)"} }),
];

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new Server(
  { name: "gitleakguard", version: "1.3.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: ENABLED ? ALL_TOOLS.filter(t => ENABLED.has(t.name)) : ALL_TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const txt = (text) => ({ content: [{ type: "text", text }] });

  // ── scan_staged ──
  if (name === "scan_staged") {
    const cwd = args.cwd ? resolve(args.cwd) : process.cwd();
    let staged;
    try {
      staged = execSync("git diff --cached --name-only --diff-filter=ACM", { cwd, encoding:"utf8", stdio:"pipe" })
        .trim().split("\n").filter(Boolean);
    } catch { return txt("Error: Not a git repository or git not available."); }
    if (!staged.length) return txt("✓ No staged files to scan.");
    const findings = [];
    for (const file of staged) {
      if (ignored(file)) continue;
      try { findings.push(...scanContent(execSync(`git show :${file}`, { cwd, encoding:"utf8", stdio:"pipe" }), file)); } catch {}
    }
    return findings.length === 0
      ? txt(`✓ Scanned ${staged.length} staged file(s) — no secrets detected. Safe to commit.`)
      : txt(formatFindings(findings, "COMMIT BLOCKED"));
  }

  // ── scan_file ──
  if (name === "scan_file") {
    const fp = resolve(args.file_path);
    if (!existsSync(fp)) return txt(`Error: File not found: ${fp}`);
    let content;
    try { content = readFileSync(fp, "utf8"); } catch (e) { return txt(`Error reading file: ${e.message}`); }
    const findings = scanContent(content, args.file_path);
    return findings.length === 0 ? txt(`✓ No secrets detected in ${args.file_path}`) : txt(formatFindings(findings, "SECRETS FOUND"));
  }

  // ── scan_directory ──
  if (name === "scan_directory") {
    const dp = resolve(args.dir_path);
    const files = walkDir(dp);
    const findings = [];
    for (const f of files) { try { findings.push(...scanContent(readFileSync(f, "utf8"), f)); } catch {} }
    return findings.length === 0
      ? txt(`✓ Scanned ${files.length} file(s) in ${args.dir_path} — no secrets detected.`)
      : txt(formatFindings(findings, `SECRETS FOUND IN ${args.dir_path}`));
  }

  // ── scan_history ──
  if (name === "scan_history") {
    const cwd = args.cwd ? resolve(args.cwd) : process.cwd();
    const depth = args.depth ?? 50;
    let commits;
    try {
      commits = execSync(`git log --oneline -${depth}`, { cwd, encoding:"utf8" }).trim().split("\n").filter(Boolean);
    } catch { return txt("Error: Not a git repository."); }
    const findings = [];
    for (const line of commits) {
      const hash = line.split(" ")[0];
      try { findings.push(...scanContent(execSync(`git show ${hash}`, { cwd, encoding:"utf8", stdio:"pipe" }), `commit:${hash}`)); } catch {}
    }
    return findings.length === 0
      ? txt(`✓ Scanned ${commits.length} commits — no secrets found in history.`)
      : txt(formatFindings(findings, `SECRETS IN GIT HISTORY (last ${commits.length} commits)`) +
          "\n\n⚠ Credentials in history are COMPROMISED. Rotate them immediately.\nRewrite history: npx git-filter-repo or BFG Repo Cleaner");
  }

  // ── sonarqube_scan ──
  if (name === "sonarqube_scan") {
    const dir = args.dir_path ? resolve(args.dir_path) : process.cwd();
    const { ok, out, err } = runTool("sonar-scanner --version");
    if (!ok) return txt("sonar-scanner not found in PATH.\nIn Docker image: already installed.\nLocally: npm install -g sonar-scanner");
    const token = args.token || process.env.SONAR_TOKEN;
    let cmd = "sonar-scanner";
    if (args.project_key) cmd += ` -Dsonar.projectKey=${args.project_key}`;
    if (args.host_url)    cmd += ` -Dsonar.host.url=${args.host_url}`;
    if (token)            cmd += ` -Dsonar.token=${token}`;
    const r = runTool(cmd, { cwd: dir });
    return txt(r.ok ? `✓ SonarQube analysis complete.\n${r.out.slice(-500)}` : `sonar-scanner failed:\n${r.err}`);
  }

  // ── sonarqube_issues ──
  if (name === "sonarqube_issues") {
    const host = args.host_url || "https://sonarcloud.io";
    const token = args.token || process.env.SONAR_TOKEN;
    if (!token) return txt("Error: token required. Pass 'token' argument or set SONAR_TOKEN env var.");
    try {
      const data = await apiGet(`${host}/api/issues/search?componentKeys=${encodeURIComponent(args.project_key)}&severities=${args.severities||"BLOCKER,CRITICAL"}&resolved=false&ps=50`, token);
      if (data.errors) return txt(`SonarQube error: ${data.errors.map(e=>e.msg).join(", ")}`);
      const issues = data.issues || [];
      if (!issues.length) return txt(`✓ No open issues in ${args.project_key}`);
      let out = `✖ ${issues.length} issue(s) in ${args.project_key}:\n\n`;
      for (const i of issues.slice(0,20)) out += `  ● [${i.severity}] ${i.message}\n    ${i.component}:${i.line||"?"}\n    Rule: ${i.rule}\n\n`;
      if (issues.length > 20) out += `  ... and ${issues.length-20} more\n`;
      return txt(out);
    } catch (e) { return txt(`Error connecting to SonarQube: ${e.message}`); }
  }

  // ── sonarqube_quality_gate ──
  if (name === "sonarqube_quality_gate") {
    const host = args.host_url || "https://sonarcloud.io";
    const token = args.token || process.env.SONAR_TOKEN;
    if (!token) return txt("Error: token required. Pass 'token' argument or set SONAR_TOKEN env var.");
    try {
      const data = await apiGet(`${host}/api/qualitygates/project_status?projectKey=${encodeURIComponent(args.project_key)}`, token);
      if (data.errors) return txt(`SonarQube error: ${data.errors.map(e=>e.msg).join(", ")}`);
      if (data.projectStatus?.status === "OK") return txt(`✓ Quality gate PASSED for ${args.project_key}`);
      let out = `✖ Quality gate FAILED for ${args.project_key}\n\nFailing conditions:\n`;
      for (const c of (data.projectStatus?.conditions||[]).filter(c=>c.status==="ERROR"))
        out += `  ● ${c.metricKey}: actual=${c.actualValue} (threshold: ${c.errorThreshold})\n`;
      return txt(out);
    } catch (e) { return txt(`Error connecting to SonarQube: ${e.message}`); }
  }

  // ── trivy_scan ──
  if (name === "trivy_scan") {
    const target = args.target || process.cwd();
    const type = args.type || "fs";
    const severity = args.severity || "HIGH,CRITICAL";
    const { ok, out, err } = runTool(`trivy ${type} --severity ${severity} --format table ${target}`);
    if (!ok && err?.includes("command not found")) return txt("trivy not found.\nIn Docker image: already installed.\nLocally: https://aquasecurity.github.io/trivy/latest/getting-started/installation/");
    return txt(ok ? (out || "✓ No vulnerabilities found.") : `trivy error:\n${err}`);
  }

  // ── semgrep_scan ──
  if (name === "semgrep_scan") {
    const dir = args.dir_path || process.cwd();
    const config = args.config || "p/security-audit";
    const { ok, out, err } = runTool(`semgrep --config ${config} --text ${dir}`);
    if (!ok && (err?.includes("command not found") || err?.includes("No such file")))
      return txt("semgrep not found.\nIn Docker image: already installed.\nLocally: pip install semgrep");
    return txt(ok ? (out || "✓ No issues found.") : `semgrep output:\n${out}\n${err}`);
  }

  // ── njsscan_scan ──
  if (name === "njsscan_scan") {
    const dir = args.dir_path || process.cwd();
    const { ok, out, err } = runTool(`njsscan --text ${dir}`);
    if (!ok && err?.includes("command not found")) return txt("njsscan not found.\nIn Docker image: already installed.\nLocally: pip install njsscan");
    return txt(ok ? (out || "✓ No issues found.") : `njsscan output:\n${out}\n${err}`);
  }

  // ── retire_scan ──
  if (name === "retire_scan") {
    const dir = args.dir_path || process.cwd();
    const { ok, out, err } = runTool(`retire --path ${dir} --outputformat text`);
    if (!ok && err?.includes("command not found")) return txt("retire not found.\nIn Docker image: already installed.\nLocally: npm install -g retire");
    return txt(ok ? (out || "✓ No vulnerable dependencies found.") : `retire output:\n${out}\n${err}`);
  }

  // ── zap_start_info ──
  if (name === "zap_start_info") {
    const key = args.api_key || "zap-api-key";
    let running = false;
    try { await apiGet(`http://localhost:8080/JSON/core/view/version/?apikey=${key}`, null); running = true; } catch {}
    const cmd = `docker run -d --name zap \\\n  -p 8080:8080 \\\n  ghcr.io/zaproxy/zaproxy:stable \\\n  zap.sh -daemon -port 8080 -host 0.0.0.0 \\\n  -config api.key=${key} \\\n  -config api.addrs.addr.name=.* \\\n  -config api.addrs.addr.regex=true`;
    return running
      ? txt(`✓ ZAP daemon is running at http://localhost:8080\nAPI key: ${key}\n\nStart command (reference):\n${cmd}`)
      : txt(`ZAP daemon NOT running. Start with:\n\n${cmd}\n\nThen use zap_scan or zap_alerts.`);
  }

  // ── zap_scan ──
  if (name === "zap_scan") {
    const zapUrl = args.zap_url || "http://localhost:8080";
    const key = args.api_key || process.env.ZAP_API_KEY || "zap-api-key";
    try { await apiGet(`${zapUrl}/JSON/core/view/version/?apikey=${key}`, null); }
    catch { return txt(`ZAP daemon not reachable at ${zapUrl}. Use zap_start_info to get the start command.`); }
    try {
      const spider = await apiPost(`${zapUrl}/JSON/spider/action/scan/`, null, { url: args.target_url, apikey: key, recurse: "true" });
      let progress = 0;
      while (progress < 100) {
        await new Promise(r => setTimeout(r, 2000));
        const s = await apiGet(`${zapUrl}/JSON/spider/view/status/?scanId=${spider.scan}&apikey=${key}`, null);
        progress = parseInt(s.status || "100");
      }
      const ascan = await apiPost(`${zapUrl}/JSON/ascan/action/scan/`, null, { url: args.target_url, recurse: "true", apikey: key });
      return txt(`✓ Spider complete. Active scan started (ID: ${ascan.scan}).\nUse zap_alerts to get results.\nMonitor: ${zapUrl}/JSON/ascan/view/status/?scanId=${ascan.scan}&apikey=${key}`);
    } catch (e) { return txt(`ZAP scan error: ${e.message}`); }
  }

  // ── zap_alerts ──
  if (name === "zap_alerts") {
    const zapUrl = args.zap_url || "http://localhost:8080";
    const key = args.api_key || process.env.ZAP_API_KEY || "zap-api-key";
    const riskOrder = { high: 3, medium: 2, low: 1, informational: 0 };
    const minRisk = riskOrder[(args.risk || "High").toLowerCase()] ?? 3;
    try {
      const data = await apiGet(`${zapUrl}/JSON/alert/view/alerts/?apikey=${key}`, null);
      const filtered = (data.alerts || []).filter(a => (riskOrder[a.risk?.toLowerCase()] ?? 0) >= minRisk);
      if (!filtered.length) return txt(`✓ No ${args.risk||"High"}+ alerts. Total: ${(data.alerts||[]).length}`);
      let out = `✖ ${filtered.length} alert(s) at ${args.risk||"High"}+:\n\n`;
      for (const a of filtered.slice(0,15))
        out += `  ● [${a.risk}] ${a.alert}\n    URL: ${a.url}\n    ${(a.description||"").slice(0,120)}\n    Solution: ${(a.solution||"See ZAP report").slice(0,100)}\n\n`;
      if (filtered.length > 15) out += `  ... and ${filtered.length-15} more.\n`;
      return txt(out + `\nFull report: ${zapUrl}/OTHER/core/other/htmlreport/?apikey=${key}`);
    } catch (e) { return txt(`ZAP not reachable at ${zapUrl}: ${e.message}`); }
  }

  return txt(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
