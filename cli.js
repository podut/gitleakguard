#!/usr/bin/env node
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const [,, cmd, sub, ...rest] = process.argv;

const CYAN  = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED   = "\x1b[31m";
const BOLD  = "\x1b[1m";
const DIM   = "\x1b[2m";
const RESET = "\x1b[0m";

const SKILLS_DIR = path.join(__dirname, "skills");

function ok(m)   { console.log(`${GREEN}✓${RESET} ${m}`); }
function warn(m) { console.log(`${YELLOW}⚠${RESET}  ${m}`); }
function err(m)  { console.error(`${RED}✖${RESET}  ${m}`); }
function info(m) { console.log(`${CYAN}▶${RESET} ${m}`); }

function availableSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs.readdirSync(SKILLS_DIR).filter(d =>
    fs.existsSync(path.join(SKILLS_DIR, d, "SKILL.md"))
  );
}

function installSkill(name) {
  const srcDir = path.join(SKILLS_DIR, name);
  if (!fs.existsSync(srcDir)) {
    err(`Skill "${name}" not found. Available: ${availableSkills().join(", ")}`);
    return false;
  }
  const destDir = path.join(os.homedir(), ".agents", "skills", name);
  fs.mkdirSync(destDir, { recursive: true });

  const files = fs.readdirSync(srcDir);
  for (const file of files) {
    fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
  }

  // Legacy file copy for older version support
  const legacyDest = path.join(os.homedir(), ".agents", "skills", `${name}.md`);
  fs.copyFileSync(path.join(srcDir, "SKILL.md"), legacyDest);

  ok(`Skill "${name}" installed → ~/.agents/skills/${name}/`);
  return true;
}

function showHelp() {
  const pkg = require("./package.json");
  console.log(`\n${BOLD}${CYAN}gitleakguard${RESET} v${pkg.version} — Git secret protection + security tools\n`);
  console.log(`${BOLD}Usage:${RESET} gitleakguard <command> [subcommand] [options]\n`);

  console.log(`${BOLD}Core commands:${RESET}`);
  console.log(`  ${CYAN}init${RESET}                   Setup pre-commit hook in current repo`);
  console.log(`  ${CYAN}scan${RESET}                   Scan staged files for secrets`);
  console.log(`  ${CYAN}history${RESET}                Scan full git history for leaked secrets\n`);

  console.log(`${BOLD}Skill commands:${RESET}`);
  console.log(`  ${CYAN}skill list${RESET}             List all available skills`);
  console.log(`  ${CYAN}skill add <name>${RESET}       Install a skill to ~/.agents/skills/`);
  console.log(`  ${CYAN}skill add <a,b,c>${RESET}      Install multiple skills (comma-separated)`);
  console.log(`  ${CYAN}skill add --all${RESET}        Install all skills\n`);

  console.log(`${BOLD}MCP commands:${RESET}`);
  console.log(`  ${CYAN}mcp setup${RESET}                      Add full MCP server to Claude Code`);
  console.log(`  ${CYAN}mcp list${RESET}                       List all MCP tools and skill groups`);
  console.log(`  ${CYAN}mcp add <skills>${RESET}               Add specific tools locally`);
  console.log(`  ${CYAN}mcp add <skills> --docker [path]${RESET} Add tools via Docker (all tools installed)\n`);

  console.log(`${BOLD}Examples:${RESET}`);
  console.log(`  ${DIM}npx gitleakguard mcp setup${RESET}`);
  console.log(`  ${DIM}npx gitleakguard mcp add trivy${RESET}`);
  console.log(`  ${DIM}npx gitleakguard mcp add trivy,semgrep,sonarqube --docker${RESET}`);
  console.log(`  ${DIM}npx gitleakguard mcp add zap --docker C:/Projects/myapp${RESET}`);
  console.log(`  ${DIM}npx gitleakguard skill add sonarqube,zap${RESET}`);
  console.log(`  ${DIM}npx gitleakguard skill add --all${RESET}\n`);
}

// ── skill ──────────────────────────────────────────────

function cmdSkill(sub, args) {
  const skills = availableSkills();

  if (!sub || sub === "list") {
    console.log(`\n${BOLD}Available skills (${skills.length}):${RESET}\n`);
    for (const s of skills) {
      const skillPath = path.join(SKILLS_DIR, s, "SKILL.md");
      const content = fs.readFileSync(skillPath, "utf8");
      const desc = content.match(/^description:\s*(.+)$/m)?.[1] || "";
      console.log(`  ${CYAN}${s.padEnd(16)}${RESET} ${desc.slice(0, 70)}`);
    }
    console.log(`\nInstall: ${DIM}npx gitleakguard skill add <name>${RESET}\n`);
    return;
  }

  if (sub === "add") {
    const target = args[0];
    if (!target) { err("Specify a skill name. Example: gitleakguard skill add sonarqube"); return; }

    if (target === "--all") {
      info(`Installing all ${skills.length} skills...`);
      let count = 0;
      for (const s of skills) { if (installSkill(s)) count++; }
      console.log(`\n${GREEN}${BOLD}✓ ${count}/${skills.length} skills installed to ~/.agents/skills/${RESET}\n`);
      return;
    }

    const names = target.split(",").map(s => s.trim()).filter(Boolean);
    let count = 0;
    for (const name of names) { if (installSkill(name)) count++; }
    if (count > 0) {
      console.log(`\n${GREEN}${BOLD}✓ ${count} skill(s) installed.${RESET}`);
      console.log(`${DIM}Restart your AI editor to load new skills.${RESET}\n`);
    }
    return;
  }

  err(`Unknown skill subcommand: ${sub}. Try: skill list | skill add <name>`);
}

// ── mcp ───────────────────────────────────────────────

// skill name → MCP tool names mapping
const SKILL_TO_TOOLS = {
  gitleakguard: ["scan_staged", "scan_file", "scan_directory", "scan_history"],
  sonarqube:    ["sonarqube_scan", "sonarqube_issues", "sonarqube_quality_gate"],
  trivy:        ["trivy_scan"],
  semgrep:      ["semgrep_scan"],
  njsscan:      ["njsscan_scan"],
  retire:       ["retire_scan"],
  zap:          ["zap_start_info", "zap_scan", "zap_alerts"],
};

const MCP_TOOLS = [
  { name: "scan_staged",            desc: "Scan git staged files for secrets" },
  { name: "scan_file",              desc: "Scan a specific file for secrets" },
  { name: "scan_directory",         desc: "Scan all files in a directory" },
  { name: "scan_history",           desc: "Scan git commit history for secrets" },
  { name: "sonarqube_scan",         desc: "Run sonar-scanner CLI on a project" },
  { name: "sonarqube_issues",       desc: "Fetch open issues from SonarQube/SonarCloud API" },
  { name: "sonarqube_quality_gate", desc: "Check SonarQube quality gate status" },
  { name: "trivy_scan",             desc: "Run Trivy vulnerability scanner" },
  { name: "semgrep_scan",           desc: "Run Semgrep SAST with security rules" },
  { name: "njsscan_scan",           desc: "Run njsscan on Node.js/JS/TS files" },
  { name: "retire_scan",            desc: "Scan npm deps for CVEs (RetireJS)" },
  { name: "zap_start_info",         desc: "Show ZAP docker start command + check if running" },
  { name: "zap_scan",               desc: "Trigger OWASP ZAP spider + active scan" },
  { name: "zap_alerts",             desc: "Get ZAP security alerts by risk level" },
];

function resolveToolNames(input) {
  const expanded = new Set();
  for (const raw of input.split(",").map(s => s.trim()).filter(Boolean)) {
    if (SKILL_TO_TOOLS[raw]) {
      SKILL_TO_TOOLS[raw].forEach(t => expanded.add(t));
    } else if (MCP_TOOLS.find(t => t.name === raw)) {
      expanded.add(raw);
    } else {
      warn(`Unknown skill/tool: "${raw}". Available: ${Object.keys(SKILL_TO_TOOLS).join(", ")}`);
    }
  }
  return [...expanded];
}

function cmdMcp(sub, args) {
  if (!sub || sub === "list") {
    console.log(`\n${BOLD}MCP tools (${MCP_TOOLS.length}):${RESET}\n`);
    for (const t of MCP_TOOLS)
      console.log(`  ${CYAN}${t.name.padEnd(28)}${RESET} ${t.desc}`);
    console.log(`\n${BOLD}Skill groups:${RESET}`);
    for (const [skill, tools] of Object.entries(SKILL_TO_TOOLS))
      console.log(`  ${CYAN}${skill.padEnd(16)}${RESET} ${tools.join(", ")}`);
    console.log(`\nSetup: ${DIM}npx gitleakguard mcp setup${RESET}`);
    console.log(`Docker: ${DIM}npx gitleakguard mcp add trivy,semgrep --docker /path/to/repo${RESET}\n`);
    return;
  }

  if (sub === "setup") {
    const serverPath = path.join(__dirname, "mcp-server.mjs").replace(/\\/g, "/");
    let claudeAvailable = false;
    try { execSync("claude --version", { stdio: "pipe" }); claudeAvailable = true; } catch {}
    if (claudeAvailable) {
      try {
        execSync(`claude mcp add --scope user gitleakguard -- node "${serverPath}"`, { stdio: "inherit" });
        console.log(`\n${GREEN}${BOLD}✓ MCP server added to Claude Code (all ${MCP_TOOLS.length} tools).${RESET}`);
        console.log(`  Restart Claude Code to load the new tools.\n`);
      } catch { warn("Claude CLI error."); printManualMcpConfig(serverPath); }
    } else {
      warn("Claude CLI not found. Add manually:");
      printManualMcpConfig(serverPath);
    }
    return;
  }

  // mcp add <skills/tools> [--docker [repo-path]]
  if (sub === "add") {
    const input = args[0];
    if (!input) { err('Specify tools. Example: gitleakguard mcp add trivy,semgrep --docker'); return; }

    const isDocker  = args.includes("--docker");
    const repoPath  = args.find(a => !a.startsWith("--") && a !== input) || process.cwd();
    const toolNames = input === "--all"
      ? MCP_TOOLS.map(t => t.name)
      : resolveToolNames(input);

    if (!toolNames.length) return;

    const serverPath = path.join(__dirname, "mcp-server.mjs").replace(/\\/g, "/");
    const mcpName    = `gitleakguard-${input.replace(/[^a-z0-9]/gi, "-")}`;
    const enabledEnv = `ENABLED_TOOLS=${toolNames.join(",")}`;

    let claudeAvailable = false;
    try { execSync("claude --version", { stdio: "pipe" }); claudeAvailable = true; } catch {}

    if (isDocker) {
      const repoAbs = path.resolve(repoPath).replace(/\\/g, "/");
      const dockerCmd = [
        "docker", "run", "-i", "--rm",
        "-v", `${repoAbs}:/repo`,
        "-e", enabledEnv,
        "--entrypoint", "gitleakguard-mcp",
        "podutpetru/gitleakguard:latest",
      ];
      info(`Adding Docker MCP server "${mcpName}" with tools: ${toolNames.join(", ")}`);
      if (claudeAvailable) {
        try {
          execSync(`claude mcp add --scope user ${mcpName} -- ${dockerCmd.join(" ")}`, { stdio: "inherit" });
          console.log(`\n${GREEN}${BOLD}✓ Docker MCP server "${mcpName}" added to Claude Code.${RESET}`);
          console.log(`  Tools: ${toolNames.join(", ")}`);
          console.log(`  Repo mounted from: ${repoAbs}\n`);
        } catch { warn("Claude CLI error."); printDockerConfig(mcpName, dockerCmd); }
      } else {
        printDockerConfig(mcpName, dockerCmd);
      }
    } else {
      info(`Adding local MCP server "${mcpName}" with tools: ${toolNames.join(", ")}`);
      if (claudeAvailable) {
        try {
          execSync(`claude mcp add --scope user ${mcpName} -- node "${serverPath}"`, { stdio: "inherit" });
          console.log(`\n${GREEN}${BOLD}✓ MCP server "${mcpName}" added.${RESET}`);
          console.log(`  Set env var to limit tools: ${CYAN}${enabledEnv}${RESET}`);
          console.log(`  Or update ~/.claude.json to add the env property.\n`);
        } catch { warn("Claude CLI error."); printManualMcpConfig(serverPath); }
      } else {
        printManualMcpConfig(serverPath, toolNames);
      }
    }
    return;
  }

  err(`Unknown mcp subcommand: ${sub}. Try: mcp list | mcp setup | mcp add <tools> [--docker]`);
}

function printDockerConfig(mcpName, dockerCmd) {
  console.log(`\nAdd to ~/.claude.json:\n`);
  console.log(`${DIM}  "${mcpName}": { "command": "${dockerCmd[0]}", "args": ${JSON.stringify(dockerCmd.slice(1))} }${RESET}\n`);
}

function printManualMcpConfig(serverPath, tools) {
  console.log(`\nAdd to your Claude Code config (~/.claude.json):\n`);
  console.log(`${DIM}{
  "mcpServers": {
    "gitleakguard": {
      "command": "node",
      "args": ["${serverPath}"]
    }
  }
}${RESET}\n`);

  console.log(`Or for Cursor/Windsurf (.cursor/mcp.json or .vscode/mcp.json):\n`);
  console.log(`${DIM}{
  "mcpServers": {
    "gitleakguard": {
      "command": "node",
      "args": ["${serverPath}"]
    }
  }
}${RESET}\n`);
}

// ── router ─────────────────────────────────────────────

if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
  showHelp();
  process.exit(0);
}

if (cmd === "skill") { cmdSkill(sub, rest);      process.exit(0); }
if (cmd === "mcp")   { cmdMcp(sub, rest);        process.exit(0); }

const CORE = {
  init:    "setup/init.js",
  scan:    "hooks/pre-commit",
  history: "setup/scan-history.js",
};

if (!CORE[cmd]) {
  err(`Unknown command: "${cmd}"`);
  showHelp();
  process.exit(1);
}

require(path.resolve(__dirname, CORE[cmd]));
