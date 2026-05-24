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
  const src = path.join(SKILLS_DIR, name, "SKILL.md");
  if (!fs.existsSync(src)) {
    err(`Skill "${name}" not found. Available: ${availableSkills().join(", ")}`);
    return false;
  }
  const dest = path.join(os.homedir(), ".agents", "skills");
  fs.mkdirSync(dest, { recursive: true });
  fs.copyFileSync(src, path.join(dest, `${name}.md`));
  ok(`Skill "${name}" installed → ~/.agents/skills/${name}.md`);
  return true;
}

function showHelp() {
  console.log(`\n${BOLD}${CYAN}gitleakguard${RESET} v1.2.0 — Git secret protection + security tools\n`);
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
  console.log(`  ${CYAN}mcp setup${RESET}              Add MCP server to Claude Code (global)`);
  console.log(`  ${CYAN}mcp list${RESET}               List available MCP tools\n`);

  console.log(`${BOLD}Examples:${RESET}`);
  console.log(`  ${DIM}npx gitleakguard init${RESET}`);
  console.log(`  ${DIM}npx gitleakguard skill add sonarqube${RESET}`);
  console.log(`  ${DIM}npx gitleakguard skill add sonarqube,zap,trivy${RESET}`);
  console.log(`  ${DIM}npx gitleakguard skill add --all${RESET}`);
  console.log(`  ${DIM}npx gitleakguard mcp setup${RESET}\n`);
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

function cmdMcp(sub) {
  const MCP_TOOLS = [
    { name: "scan_staged",           desc: "Scan git staged files for secrets" },
    { name: "scan_file",             desc: "Scan a specific file for secrets" },
    { name: "scan_directory",        desc: "Scan all files in a directory" },
    { name: "scan_history",          desc: "Scan git commit history for secrets" },
    { name: "sonarqube_issues",      desc: "Fetch open issues from SonarQube/SonarCloud API" },
    { name: "sonarqube_quality_gate",desc: "Check SonarQube quality gate status" },
    { name: "sonarqube_scan",        desc: "Run sonar-scanner CLI on a project" },
    { name: "zap_scan",              desc: "Trigger OWASP ZAP spider + active scan" },
    { name: "zap_alerts",            desc: "Get ZAP security alerts by risk level" },
    { name: "zap_start_info",        desc: "Show ZAP docker start command + check if running" },
  ];

  if (!sub || sub === "list") {
    console.log(`\n${BOLD}MCP tools (${MCP_TOOLS.length}):${RESET}\n`);
    for (const t of MCP_TOOLS) {
      console.log(`  ${CYAN}${t.name.padEnd(28)}${RESET} ${t.desc}`);
    }
    console.log(`\nAdd to Claude Code: ${DIM}npx gitleakguard mcp setup${RESET}\n`);
    return;
  }

  if (sub === "setup") {
    const serverPath = path.join(__dirname, "mcp-server.mjs").replace(/\\/g, "/");
    let claudeAvailable = false;
    try { execSync("claude --version", { stdio: "pipe" }); claudeAvailable = true; } catch {}

    if (claudeAvailable) {
      try {
        execSync(`claude mcp add --scope user gitleakguard -- node "${serverPath}"`, { stdio: "inherit" });
        console.log(`\n${GREEN}${BOLD}✓ MCP server added to Claude Code.${RESET}`);
        console.log(`  Restart Claude Code to load the new tools.\n`);
      } catch (e) {
        warn("Claude CLI error. Adding manually...");
        printManualMcpConfig(serverPath);
      }
    } else {
      warn("Claude CLI not found. Add manually:");
      printManualMcpConfig(serverPath);
    }
    return;
  }

  err(`Unknown mcp subcommand: ${sub}. Try: mcp list | mcp setup`);
}

function printManualMcpConfig(serverPath) {
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

if (cmd === "skill") { cmdSkill(sub, rest); process.exit(0); }
if (cmd === "mcp")   { cmdMcp(sub);         process.exit(0); }

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
