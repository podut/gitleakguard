#!/usr/bin/env node
// GitKeeper retroactive scanner — checks full git history for exposed secrets
const { execSync } = require("child_process");
const { scanContent, shouldIgnore } = require("../scanners/secrets.js");

const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN  = "\x1b[32m";
const CYAN   = "\x1b[36m";
const BOLD   = "\x1b[1m";
const RESET  = "\x1b[0m";

console.log(`\n${BOLD}${CYAN}GitKeeper — Git History Scanner${RESET}\n`);

let commits;
try {
  commits = execSync("git log --all --format=%H", { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);
} catch {
  console.error("Not a git repo or no commits found.");
  process.exit(1);
}

console.log(`Scanning ${commits.length} commit(s)...\n`);

const allFindings = [];
const seen = new Set(); // deduplicate same secret across commits

for (const commit of commits) {
  let files;
  try {
    files = execSync(`git diff-tree --no-commit-id -r --name-only ${commit}`, {
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .filter(Boolean);
  } catch {
    continue;
  }

  for (const file of files) {
    if (shouldIgnore(file)) continue;
    let content;
    try {
      content = execSync(`git show ${commit}:${file}`, { encoding: "utf8" });
    } catch {
      continue;
    }

    const findings = scanContent(content, file);
    for (const f of findings) {
      const key = `${f.rule}:${f.match}`;
      if (!seen.has(key)) {
        seen.add(key);
        allFindings.push({ ...f, commit: commit.slice(0, 8) });
      }
    }
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
