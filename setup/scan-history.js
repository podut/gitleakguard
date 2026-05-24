#!/usr/bin/env node
// gitleakguard retroactive scanner — checks full git history for exposed secrets
const { execSync } = require("child_process");
const { scanContent, shouldIgnore } = require("../scanners/secrets.js");

const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN  = "\x1b[32m";
const CYAN   = "\x1b[36m";
const BOLD   = "\x1b[1m";
const RESET  = "\x1b[0m";

console.log(`\n${BOLD}${CYAN}gitleakguard — Git History Scanner${RESET}\n`);

let output;
try {
  console.log("Retrieving full git history diffs...");
  output = execSync("git log -p --all --format=COMMIT:%H", { encoding: "utf8", maxBuffer: 100 * 1024 * 1024 });
} catch {
  console.error("Not a git repo or failed to retrieve git log.");
  process.exit(1);
}

const lines = output.split("\n");
console.log(`Scanning changes (${lines.length} lines)...`);

const allFindings = [];
const seen = new Set(); // deduplicate same secret across commits
let currentCommit = "";
let currentFile = "";
let currentLine = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.startsWith("COMMIT:")) {
    currentCommit = line.slice(7).trim();
    currentFile = "";
    continue;
  }
  if (line.startsWith("diff --git a/")) {
    const match = line.match(/b\/(.+)$/);
    if (match) {
      currentFile = match[1].trim();
    }
    continue;
  }
  if (line.startsWith("@@ ")) {
    const match = line.match(/\+(\d+)/);
    if (match) {
      currentLine = parseInt(match[1], 10);
    }
    continue;
  }
  if (line.startsWith("+") && !line.startsWith("+++")) {
    if (shouldIgnore(currentFile)) {
      currentLine++;
      continue;
    }
    const addedContent = line.slice(1);
    const findings = scanContent(addedContent, currentFile);
    for (const f of findings) {
      const key = `${f.rule}:${addedContent.trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        allFindings.push({
          ...f,
          line: currentLine,
          commit: currentCommit.slice(0, 8),
        });
      }
    }
    currentLine++;
  } else if (line.startsWith(" ")) {
    currentLine++;
  }
}

if (allFindings.length === 0) {
  console.log(`${GREEN}✓ No secrets found in git history.${RESET}\n`);
  process.exit(0);
}

console.log(`${RED}${BOLD}✖ Found ${allFindings.length} unique secret(s) in history:${RESET}\n`);

for (const f of allFindings) {
  console.log(`  ${RED}●${RESET} ${BOLD}${f.rule}${RESET} (first seen in commit ${YELLOW}${f.commit}${RESET})`);
  console.log(`    File: ${f.file}:${f.line}`);
  console.log(`    Preview: ${YELLOW}${f.preview}${RESET}\n`);
}

console.log(`${BOLD}Next steps:${RESET}`);
console.log("  1. Revoke every exposed credential immediately (change the key/token)");
console.log("  2. If the repo is public, assume the credential is already compromised");
console.log(`  3. To remove from history: ${CYAN}git filter-repo --invert-paths --path <file>${RESET}`);
console.log("     (requires: pip install git-filter-repo)");
console.log(`  4. Force-push the cleaned history and notify all collaborators\n`);
