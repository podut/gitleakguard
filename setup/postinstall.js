#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const os = require("os");

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function ok(msg)   { console.log(`${GREEN}✓${RESET} ${msg}`); }
function warn(msg) { console.log(`${YELLOW}⚠${RESET}  ${msg}`); }

function installSkillsGlobally() {
  console.log(`\n${BOLD}${CYAN}▶ Installing global AI editor skills (Gemini, Antigravity, Cursor, Claude Code)...${RESET}`);
  const skillsDir = path.resolve(__dirname, "../skills");
  if (!fs.existsSync(skillsDir)) {
    warn("Skills directory not found in package. Skipping.");
    return;
  }

  const skills = fs.readdirSync(skillsDir).filter(d =>
    fs.existsSync(path.join(skillsDir, d, "SKILL.md"))
  );

  let agentsCount = 0;
  let geminiCount = 0;
  let claudeCount = 0;

  for (const s of skills) {
    const srcDir = path.join(skillsDir, s);
    const skillMdPath = path.join(srcDir, "SKILL.md");

    // 1. Antigravity & Cursor (~/.agents/skills/<skill>/)
    try {
      const destDir = path.join(os.homedir(), ".agents", "skills", s);
      fs.mkdirSync(destDir, { recursive: true });
      const files = fs.readdirSync(srcDir);
      for (const file of files) {
        fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
      }
      // Legacy name.md file copy
      const legacyDest = path.join(os.homedir(), ".agents", "skills", `${s}.md`);
      fs.copyFileSync(skillMdPath, legacyDest);
      agentsCount++;
    } catch (e) {
      warn(`Failed to install ${s} to ~/.agents/skills: ${e.message}`);
    }

    // 2. Gemini CLI (~/.gemini/skills/<skill>/)
    try {
      const destDir = path.join(os.homedir(), ".gemini", "skills", s);
      fs.mkdirSync(destDir, { recursive: true });
      const files = fs.readdirSync(srcDir);
      for (const file of files) {
        fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
      }
      // Legacy name.md file copy
      const legacyDest = path.join(os.homedir(), ".gemini", "skills", `${s}.md`);
      fs.copyFileSync(skillMdPath, legacyDest);
      geminiCount++;
    } catch (e) {
      warn(`Failed to install ${s} to ~/.gemini/skills: ${e.message}`);
    }

    // 3. Claude Code (~/.claude/commands/<skill>.md)
    try {
      const claudeDest = path.join(os.homedir(), ".claude", "commands");
      fs.mkdirSync(claudeDest, { recursive: true });
      // Special case for gitleakguard - we want the special command version if available
      const gitleakguardSpecial = path.resolve(__dirname, "../.claude/commands/gitleakguard.md");
      if (s === "gitleakguard" && fs.existsSync(gitleakguardSpecial)) {
        fs.copyFileSync(gitleakguardSpecial, path.join(claudeDest, "gitleakguard.md"));
      } else {
        fs.copyFileSync(skillMdPath, path.join(claudeDest, `${s}.md`));
      }
      claudeCount++;
    } catch (e) {
      warn(`Failed to install ${s} to ~/.claude/commands: ${e.message}`);
    }
  }

  if (agentsCount > 0) ok(`Installed ${agentsCount} skills to ~/.agents/skills/ (Antigravity & Cursor)`);
  if (geminiCount > 0) ok(`Installed ${geminiCount} skills to ~/.gemini/skills/ (Gemini)`);
  if (claudeCount > 0) ok(`Installed ${claudeCount} skills to ~/.claude/commands/ (Claude Code)`);
}

try {
  installSkillsGlobally();
} catch (e) {
  warn(`Postinstall failed: ${e.message}`);
}
