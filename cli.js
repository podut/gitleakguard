#!/usr/bin/env node
// leakguard CLI — entry point for `npx leakguard` or `leakguard` (if installed globally)
const { execSync } = require("child_process");
const path = require("path");

const [,, command, ...args] = process.argv;

const CYAN  = "\x1b[36m";
const BOLD  = "\x1b[1m";
const RESET = "\x1b[0m";

const commands = {
  init:    { desc: "Setup leakguard in the current repo",         script: "setup/init.js" },
  scan:    { desc: "Scan staged files for secrets (manual run)",  script: "hooks/pre-commit" },
  history: { desc: "Scan full git history for leaked secrets",    script: "setup/scan-history.js" },
  help:    { desc: "Show this help message",                      script: null },
};

function showHelp() {
  console.log(`\n${BOLD}${CYAN}leakguard${RESET} — Git secret protection for vibe coders\n`);
  console.log("Usage: leakguard <command>\n");
  for (const [cmd, { desc }] of Object.entries(commands)) {
    console.log(`  ${CYAN}${cmd.padEnd(10)}${RESET} ${desc}`);
  }
  console.log();
}

if (!command || command === "help" || command === "--help" || command === "-h") {
  showHelp();
  process.exit(0);
}

const target = commands[command];
if (!target) {
  console.error(`Unknown command: ${command}`);
  showHelp();
  process.exit(1);
}

require(path.resolve(__dirname, target.script));
