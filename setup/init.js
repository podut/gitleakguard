#!/usr/bin/env node
// leakguard setup — run once per repo: node setup/init.js
const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const readline = require("readline");

const keeper = require("../integrations/keeper.js");

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RED = "\x1b[31m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

function step(msg) { console.log(`\n${CYAN}▶${RESET} ${BOLD}${msg}${RESET}`); }
function ok(msg)   { console.log(`${GREEN}✓${RESET} ${msg}`); }
function warn(msg) { console.log(`${YELLOW}⚠${RESET}  ${msg}`); }
function err(msg)  { console.log(`${RED}✖${RESET}  ${msg}`); }

function isGitRepo() {
  try { execSync("git rev-parse --git-dir", { stdio: "ignore" }); return true; }
  catch { return false; }
}

function installHook() {
  const hookSrc  = path.resolve(__dirname, "../hooks/pre-commit");
  const gitDir   = execSync("git rev-parse --git-dir", { encoding: "utf8" }).trim();
  const hooksDir = path.join(gitDir, "hooks");
  const hookDst  = path.join(hooksDir, "pre-commit");

  fs.mkdirSync(hooksDir, { recursive: true });
  fs.copyFileSync(hookSrc, hookDst);
  fs.chmodSync(hookDst, 0o755);
  ok(`Pre-commit hook installed → ${hookDst}`);
}

function setupGitignore() {
  const gitignorePath = path.join(process.cwd(), ".gitignore");
  const entries = [".env", ".env.local", ".env.*.local", "*.pem", "*.key"];
  let content = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, "utf8") : "";

  let added = 0;
  for (const entry of entries) {
    if (!content.includes(entry)) { content += `\n${entry}`; added++; }
  }
  if (added > 0) {
    fs.writeFileSync(gitignorePath, content.trimStart());
    ok(`.gitignore updated (${added} entries added)`);
  } else {
    ok(".gitignore already has required entries");
  }
}

function createEnvTemplate() {
  const templatePath = path.join(process.cwd(), ".env.example");
  if (!fs.existsSync(templatePath)) {
    fs.writeFileSync(templatePath, [
      "# Copy to .env and fill in your values",
      "# NEVER commit .env to git",
      "",
      "API_KEY=your_api_key_here",
      "DATABASE_URL=postgresql://user:password@localhost:5432/mydb",
      "SECRET_KEY=your_secret_key_here",
      "",
    ].join("\n"));
    ok(".env.example template created");
  }
}

async function setupKeeperIntegration() {
  step("Keeper Secret Manager integration (optional)");
  const useKeeper = await ask("  Set up Keeper SSH signing? (y/N): ");
  if (!useKeeper.toLowerCase().startsWith("y")) {
    warn("Skipping Keeper integration. You can run this again later.");
    return;
  }

  if (!keeper.isKsmInstalled()) {
    warn("KSM CLI not found. Installing...");
    try {
      execSync("npm install -g @keepersecurity/secrets-manager-cli", { stdio: "inherit" });
      ok("KSM CLI installed");
    } catch {
      err("Install failed. Try manually: npm install -g @keepersecurity/secrets-manager-cli");
      return;
    }
  } else {
    ok("KSM CLI already installed");
  }

  if (!keeper.isConfigured()) {
    console.log(`\n  ${YELLOW}You need a Keeper one-time access token.${RESET}`);
    console.log("  Get it from: Keeper Vault → Secrets Manager → Create Application → One-Time Token\n");
    const token = await ask("  Paste your one-time token: ");
    if (!token.trim()) { err("No token provided. Skipping."); return; }

    try {
      execSync(`ksm init default ${token.trim()}`, { stdio: "inherit" });
      ok("KSM configured successfully");
    } catch {
      err("KSM init failed. Check your token and try again.");
      return;
    }
  } else {
    ok("KSM already configured");
  }

  // Configure Git SSH signing
  const sshKeyPath = path.join(os.homedir(), ".ssh", "id_ed25519");
  if (fs.existsSync(sshKeyPath)) {
    const pubKey = fs.readFileSync(sshKeyPath + ".pub", "utf8").trim();
    execSync(`git config --global user.signingkey "${pubKey}"`);
    execSync('git config --global gpg.format ssh');
    execSync('git config --global commit.gpgsign true');
    ok("Git SSH commit signing enabled");
  } else {
    warn(`No SSH key at ${sshKeyPath}. Generate one first: ssh-keygen -t ed25519`);
  }
}

async function main() {
  console.log(`\n${BOLD}${CYAN}  leakguard Setup${RESET}\n`);
  console.log("  Securing your commits in 4 steps...\n");

  if (!isGitRepo()) {
    err("Not a git repository. Run: git init");
    process.exit(1);
  }

  step("Installing pre-commit hook");
  installHook();

  step("Configuring .gitignore");
  setupGitignore();

  step("Creating .env template");
  createEnvTemplate();

  await setupKeeperIntegration();

  rl.close();
  console.log(`\n${GREEN}${BOLD}  ✓ leakguard is active.${RESET}`);
  console.log("  Your next commit will be scanned automatically.\n");
  console.log(`  Run ${CYAN}node setup/scan-history.js${RESET} to check past commits.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
