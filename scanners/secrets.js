// Secret pattern scanner — detects credentials in staged files
const PATTERNS = [
  { name: "AWS Access Key",      regex: /AKIA[0-9A-Z]{16}/g },
  { name: "AWS Secret Key",      regex: /(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/g },
  { name: "GitHub Token",        regex: /ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82}/g },
  { name: "OpenAI API Key",      regex: /sk-[A-Za-z0-9]{48}|sk-proj-[A-Za-z0-9_-]{100,}/g },
  { name: "Anthropic API Key",   regex: /sk-ant-api\d{2}-[A-Za-z0-9_-]{95}/g },
  { name: "Google API Key",      regex: /AIza[0-9A-Za-z_-]{35}/g },
  { name: "Stripe Secret Key",   regex: /sk_live_[A-Za-z0-9]{24,}/g },
  { name: "Stripe Test Key",     regex: /sk_test_[A-Za-z0-9]{24,}/g },
  { name: "Slack Bot Token",     regex: /xoxb-[0-9]{11,13}-[0-9]{11,13}-[a-zA-Z0-9]{24}/g },
  { name: "Slack User Token",    regex: /xoxp-[0-9-]{30,}/g },
  { name: "Firebase Config",     regex: /AAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140}/g },
  { name: "Private Key Block",   regex: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
  { name: "JWT Token",           regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { name: "Basic Auth in URL",   regex: /https?:\/\/[^:@\s]+:[^@\s]+@[^\s]+/g },
  { name: "Generic Secret Var",  regex: /(?:secret|password|passwd|api_key|apikey|auth_token|access_token)\s*[=:]\s*['"][^'"]{8,}['"]/gi },
];

// Files and dirs that are safe to skip
const IGNORE_PATHS = [
  /node_modules\//,
  /\.git\//,
  /dist\//,
  /build\//,
  /\.env\.example$/,
  /\.env\.template$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
];

function shouldIgnore(filePath) {
  return IGNORE_PATHS.some((p) => p.test(filePath));
}

function scanContent(content, filePath) {
  const findings = [];
  for (const { name, regex } of PATTERNS) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const lineNumber = content.slice(0, match.index).split("\n").length;
      const lineContent = content.split("\n")[lineNumber - 1].trim();
      findings.push({
        rule: name,
        file: filePath,
        line: lineNumber,
        preview: lineContent.length > 80 ? lineContent.slice(0, 77) + "..." : lineContent,
        match: match[0].slice(0, 12) + "...",
      });
    }
  }
  return findings;
}

module.exports = { scanContent, shouldIgnore, PATTERNS };
