// Keeper Secret Manager integration — stores SSH keys & credentials in vault
const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const KSM_CONFIG_DIR = path.join(os.homedir(), ".config", "keeper");
const KSM_CONFIG_FILE = path.join(KSM_CONFIG_DIR, "ksm-config.json");

function isKsmInstalled() {
  const result = spawnSync("ksm", ["version"], { encoding: "utf8" });
  return result.status === 0;
}

function isPythonSdkInstalled() {
  const result = spawnSync("python3", ["-c", "import keeper_secrets_manager_cli"], {
    encoding: "utf8",
  });
  return result.status === 0;
}

function isConfigured() {
  return fs.existsSync(KSM_CONFIG_FILE);
}

function readConfig() {
  if (!isConfigured()) return null;
  return JSON.parse(fs.readFileSync(KSM_CONFIG_FILE, "utf8"));
}

function saveConfig(config) {
  fs.mkdirSync(KSM_CONFIG_DIR, { recursive: true });
  fs.writeFileSync(KSM_CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

function getSecret(uid) {
  if (!isKsmInstalled()) throw new Error("KSM CLI not installed. Run: npm install -g @keepersecurity/secrets-manager-cli");
  const result = spawnSync("ksm", ["secret", "get", "-u", uid, "--json"], {
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(`KSM error: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

function listSecrets() {
  const result = spawnSync("ksm", ["secret", "list", "--json"], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`KSM error: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

function storeSSHKeyInKeeper(keyPath, title) {
  const keyContent = fs.readFileSync(keyPath, "utf8");
  const pubKeyContent = fs.existsSync(keyPath + ".pub")
    ? fs.readFileSync(keyPath + ".pub", "utf8")
    : "";

  // Uses KSM CLI to create a new SSH Key record
  const payload = JSON.stringify({
    title,
    type: "sshKeys",
    fields: [
      { type: "keyPair", value: [{ privateKey: keyContent, publicKey: pubKeyContent }] },
    ],
  });

  const result = spawnSync("ksm", ["secret", "add", "--data", payload], {
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(`Failed to store key: ${result.stderr}`);
  return result.stdout.trim();
}

function fetchSSHKeyFromKeeper(uid, outputPath) {
  const secret = getSecret(uid);
  const keyPair = secret.fields?.find((f) => f.type === "keyPair");
  if (!keyPair) throw new Error("No SSH key found in this record");

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, keyPair.value[0].privateKey, { mode: 0o600 });
  if (keyPair.value[0].publicKey) {
    fs.writeFileSync(outputPath + ".pub", keyPair.value[0].publicKey, { mode: 0o644 });
  }
}

module.exports = {
  isKsmInstalled,
  isPythonSdkInstalled,
  isConfigured,
  readConfig,
  saveConfig,
  getSecret,
  listSecrets,
  storeSSHKeyInKeeper,
  fetchSSHKeyFromKeeper,
  KSM_CONFIG_DIR,
  KSM_CONFIG_FILE,
};
