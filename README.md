# gitleakguard

**One-command Git secret protection for vibe coders.**

Protejează-ți commit-urile de credențiale expuse (API keys, tokens, parole) cu un hook pre-commit automat și integrare opțională cu Keeper Secret Manager.

```
$ npx gitleakguard init

  gitleakguard Setup

▶ Installing pre-commit hook
✓ Pre-commit hook installed → .git/hooks/pre-commit

▶ Configuring .gitignore
✓ .gitignore updated (5 entries added)

▶ Creating .env template
✓ .env.example created

✓ gitleakguard is active. Your next commit will be scanned automatically.
```

---

## Ce face

| Funcție | Descriere |
|---|---|
| **Pre-commit hook** | Blochează commit-ul dacă detectează credențiale |
| **History scanner** | Scanează retroactiv tot istoricul git |
| **AI Editor Skill** | `/gitleakguard` slash command în Claude Code, Cursor, Windsurf |
| **Docker** | Rulează în orice CI/CD fără instalare locală |
| **Keeper integration** | Stochează cheile SSH în vault pentru semnare commit-uri |
| **Auto-remediation** | Oferă pași exacți + prompt gata pentru orice AI editor |

---

## Instalare rapidă

### AI Editor Skill (Claude Code, Cursor, Windsurf, Copilot)

```bash
npx skills add podutpetru/gitleakguard
```

Instalează skill-ul în orice editor AI care suportă formatul Vercel Skills.
Activează `/gitleakguard` ca slash command în Claude Code, Cursor Agent etc.

### macOS / Linux / WSL

```bash
curl -fsSL https://raw.githubusercontent.com/podutpetru/gitleakguard/main/install.sh | sh
```

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/podutpetru/gitleakguard/main/install.ps1 | iex
```

### Docker

```bash
# Scanează staged files din repo-ul curent
docker run --rm -v "$(pwd):/repo" podutpetru/gitleakguard scan

# Scanează tot istoricul git
docker run --rm -v "$(pwd):/repo" podutpetru/gitleakguard history

# Setup (instalează hook-ul în repo-ul montat)
docker run --rm -v "$(pwd):/repo" podutpetru/gitleakguard init
```

> Image: [`podutpetru/gitleakguard`](https://hub.docker.com/r/podutpetru/gitleakguard) — node:18-alpine + git, ~50MB

### npm / npx

```bash
# Fără instalare:
npx gitleakguard init

# Global:
npm install -g gitleakguard
gitleakguard init
```

### Manual (clone)

```bash
git clone https://github.com/podutpetru/gitleakguard.git .gitleakguard
cd .gitleakguard
node cli.js init
```

---

## Opțiuni instalare

```bash
# Doar hook-ul (fără skills AI editors)
curl -fsSL https://raw.githubusercontent.com/podutpetru/gitleakguard/main/install.sh | sh -s -- --hook-only

# Fără skills globale (Claude, Cursor, Gemini CLI)
curl -fsSL https://raw.githubusercontent.com/podutpetru/gitleakguard/main/install.sh | sh -s -- --no-editor-skills

# Windows — doar hook
irm https://raw.githubusercontent.com/podutpetru/gitleakguard/main/install.ps1 | iex -HookOnly
```

---

## Comenzi

```bash
gitleakguard init      # Setup complet (hook + gitignore + Keeper opțional)
gitleakguard scan      # Scanează manual fișierele staged
gitleakguard history   # Scanează tot istoricul git pentru secrete expuse
gitleakguard help      # Afișează ajutor
```

---

## Cum funcționează hook-ul

La fiecare `git commit`, hook-ul rulează automat și verifică fișierele staged:

```
$ git commit -m "add openai integration"
gitleakguard — scanning staged files for secrets...

✖  Commit blocked — 1 secret(s) detected:

  ● OpenAI API Key
    File: src/api.js:14
    Preview: const apiKey = "sk-proj-abc123...";

How to fix:
  1. Move the secret to a .env file
  2. Add .env to .gitignore
  3. Replace the value with process.env.YOUR_KEY in code
  4. Revoke and rotate the exposed credential

AI prompt to fix automatically:
  "Find all hardcoded credentials and move them to .env,
   replacing with process.env.VARIABLE_NAME"

To bypass (not recommended): LEAKGUARD_BYPASS=1 git commit ...
```

---

## Credențiale detectate

| Tip | Pattern |
|---|---|
| AWS Access Key | `AKIA` + 16 chars |
| GitHub Token | `ghp_...`, `github_pat_...` |
| OpenAI API Key | `sk-[48+ chars]`, `sk-proj-...` |
| Anthropic API Key | `sk-ant-api03-...` |
| Google API Key | `AIza` + 35 chars |
| Stripe Keys | `sk_live_...`, `sk_test_...` |
| Slack Tokens | `xoxb-...` |
| Private Keys | `-----BEGIN PRIVATE KEY-----` |
| JWT Tokens | `eyJ...` cu 3 segmente |
| URL cu parolă | `scheme://user:pass@host` |
| Variabile generice | `password = "..."`, `api_key = "..."` |

---

## Docker — pentru CI/CD

Imaginea Docker e utilă în pipeline-uri automate unde nu vrei să instalezi Node.js.
Nu e un MCP server — pentru integrarea cu AI editors folosește skill-ul de mai jos.

Image: [`podutpetru/gitleakguard`](https://hub.docker.com/r/podutpetru/gitleakguard)

### GitHub Actions

```yaml
- name: Scan for secrets
  run: |
    docker run --rm -v "${{ github.workspace }}:/repo" podutpetru/gitleakguard scan
```

### GitLab CI

```yaml
scan-secrets:
  image: podutpetru/gitleakguard
  script:
    - gitleakguard scan
  variables:
    GIT_STRATEGY: fetch
```

### Linie de comandă

```bash
# Scan staged files
docker run --rm -v "$(pwd):/repo" podutpetru/gitleakguard scan

# Scan git history
docker run --rm -v "$(pwd):/repo" podutpetru/gitleakguard history
```

---

## AI Editor Skill — `npx skills add`

Cel mai simplu mod de a instala skill-ul în orice editor AI compatibil:

```bash
npx skills add podutpetru/gitleakguard
```

Sau explicit:
```bash
npx skills add podutpetru/gitleakguard --skill gitleakguard
```

Skill-ul se instalează automat în directorul potrivit pentru editorul detectat.
Activează slash command-ul `/gitleakguard` cu 4 moduri:

| Comandă | Ce face |
|---|---|
| `/gitleakguard init` | Setup complet în repo-ul curent |
| `/gitleakguard scan` | Scanează staged files pentru secrete |
| `/gitleakguard history` | Scanează tot istoricul git |
| `/gitleakguard fix` | Ghid pas cu pas pentru un credential deja expus |

---

## Integrare în medii de dezvoltare

`install.sh` / `install.ps1` instalează automat:
- `CLAUDE.md` — Claude Code (activ automat)
- `GEMINI.md` — Gemini CLI + Antigravity (activ automat)
- `.cursor/rules/gitleakguard.mdc` — Cursor (alwaysApply: true)
- `.vscode/tasks.json` — VSCode tasks

Și global:
- `~/.claude/commands/gitleakguard.md` → `/gitleakguard` în Claude Code
- `~/.cursor/skills/gitleakguard/` → `/gitleakguard` în Cursor Agent

### Claude Code

```bash
mkdir -p ~/.claude/commands
curl -fsSL https://raw.githubusercontent.com/podutpetru/gitleakguard/main/.claude/commands/gitkeeper.md \
  > ~/.claude/commands/gitleakguard.md
```

Utilizare: `/gitleakguard scan`, `/gitleakguard fix`, `/gitleakguard history`

### Cursor

```bash
mkdir -p .cursor/rules
curl -fsSL https://raw.githubusercontent.com/podutpetru/gitleakguard/main/templates/cursor-rule.mdc \
  > .cursor/rules/gitleakguard.mdc
```

### Gemini CLI / Antigravity

```bash
curl -fsSL https://raw.githubusercontent.com/podutpetru/gitleakguard/main/templates/GEMINI.md >> GEMINI.md
```

### VSCode

Tasks instalate automat. `Ctrl+Shift+P` → Run Task → gitleakguard.

### Suport pentru orice AI editor

| Editor | Fișier instrucțiuni |
|---|---|
| Claude Code | `CLAUDE.md` |
| Gemini CLI / Antigravity | `GEMINI.md` |
| Cursor | `.cursor/rules/gitleakguard.mdc` |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Windsurf | `.windsurf/rules/gitleakguard.md` |
| Aider | `.aider.conf.yml` → `system-prompt:` |
| Continue.dev | `.continuerc.json` → `systemMessage:` |

---

## Integrare Keeper Secret Manager

```bash
gitleakguard init
# → alege "y" la "Set up Keeper SSH signing?"
```

Stochează cheile SSH în Keeper Vault și le folosește pentru semnarea commit-urilor.

---

## Scanare istorică și remediere

```bash
# Scanează tot istoricul
gitleakguard history

# Curăță istoricul (necesită git-filter-repo)
pip install git-filter-repo
git filter-repo --invert-paths --path src/config.ts
git push --force-with-lease
```

**Dacă repo-ul e public:** rotește imediat orice credential găsit — ștergerea din istoric nu e suficientă.

---

## Structura proiectului

```
gitleakguard/
├── cli.js                    # Entry point: gitleakguard <command>
├── package.json
├── Dockerfile                # Docker image
├── install.sh                # Installer POSIX
├── install.ps1               # Installer Windows
├── scanners/secrets.js       # Regex patterns pentru 15+ tipuri de credențiale
├── hooks/pre-commit          # Hook instalat în .git/hooks/pre-commit
├── setup/init.js             # Setup interactiv one-command
├── setup/scan-history.js     # Scanner retroactiv git history
├── integrations/keeper.js    # Keeper Secret Manager wrapper
├── templates/
│   ├── CLAUDE.md             # Template instrucțiuni Claude Code
│   ├── GEMINI.md             # Template instrucțiuni Gemini CLI
│   └── cursor-rule.mdc       # Template regulă Cursor
└── .vscode/tasks.json        # VSCode tasks
```

---

## FAQ

**Q: Cum bypass-uiesc hook-ul?**
```bash
LEAKGUARD_BYPASS=1 git commit -m "message"
```

**Q: Hook-ul blochează `.env.example`?**
Nu — `.env.example`, `.env.template`, `node_modules/` sunt excluse automat.

**Q: Funcționează pe Windows?**
Da — Node.js ≥ 18 pe orice platformă. Sau folosește Docker.

**Q: Pot adăuga pattern-uri proprii?**
```javascript
// scanners/secrets.js
{ name: "My Pattern", regex: /your-regex/g },
```

---

## Licență

MIT — folosește, modifică, distribuie liber.
