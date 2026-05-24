# leakguard

**One-command Git secret protection for vibe coders.**

Protejează-ți commit-urile de credențiale expuse (API keys, tokens, parole) cu un hook pre-commit automat și integrare opțională cu Keeper Secret Manager.

```
$ node cli.js init

  leakguard Setup

▶ Installing pre-commit hook
✓ Pre-commit hook installed → .git/hooks/pre-commit

▶ Configuring .gitignore
✓ .gitignore updated (5 entries added)

▶ Creating .env template
✓ .env.example created

✓ leakguard is active. Your next commit will be scanned automatically.
```

---

## Ce face

| Funcție | Descriere |
|---|---|
| **Pre-commit hook** | Blochează commit-ul dacă detectează credențiale |
| **History scanner** | Scanează retroactiv tot istoricul git |
| **Keeper integration** | Stochează cheile SSH în vault pentru semnare commit-uri |
| **Auto-remediation** | Oferă pași exacți + prompt gata pentru Cursor/AI |

---

## Instalare rapidă

### macOS / Linux / WSL

```bash
curl -fsSL https://raw.githubusercontent.com/podut/leakguard/main/install.sh | sh
```

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/podut/leakguard/main/install.ps1 | iex
```

### npm (global)

```bash
npm install -g leakguard
leakguard init
```

### npx (fără instalare)

```bash
npx leakguard init
```

### Manual (clone)

```bash
git clone https://github.com/podut/leakguard.git .leakguard
cd .leakguard
node cli.js init
```

---

## Opțiuni instalare

```bash
# Doar hook-ul (fără skills AI editors)
curl -fsSL https://raw.githubusercontent.com/podut/leakguard/main/install.sh | sh -s -- --hook-only

# Fără skills globale (Claude, Cursor, Gemini CLI)
curl -fsSL https://raw.githubusercontent.com/podut/leakguard/main/install.sh | sh -s -- --no-editor-skills

# Windows — doar hook
irm https://raw.githubusercontent.com/podut/leakguard/main/install.ps1 | iex -HookOnly
```

---

## Comenzi

```bash
node cli.js init      # Setup complet (hook + gitignore + Keeper opțional)
node cli.js scan      # Scanează manual fișierele staged
node cli.js history   # Scanează tot istoricul git pentru secrete expuse
node cli.js help      # Afișează ajutor
```

---

## Cum funcționează hook-ul

La fiecare `git commit`, hook-ul rulează automat și verifică fișierele staged:

```
$ git commit -m "add openai integration"
leakguard — scanning staged files for secrets...

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

## Integrare în medii de dezvoltare

`install.sh` / `install.ps1` instalează automat fișierele de instrucțiuni în proiect:
- `CLAUDE.md` — Claude Code (activ automat)
- `GEMINI.md` — Gemini CLI + Antigravity (activ automat)
- `.cursor/rules/leakguard.mdc` — Cursor (alwaysApply: true)
- `.vscode/tasks.json` — VSCode tasks

Și global (skills invocabile cu slash commands):
- `~/.claude/commands/leakguard.md` → `/leakguard` în Claude Code
- `~/.cursor/skills/leakguard/` → `/leakguard` în Cursor Agent
- Gemini CLI skill → `/leakguard` în Gemini CLI

### Claude Code

**Instalare manuală skill global:**
```bash
mkdir -p ~/.claude/commands
curl -fsSL https://raw.githubusercontent.com/podut/leakguard/main/.claude/commands/gitkeeper.md \
  > ~/.claude/commands/leakguard.md
```

**Utilizare:**
```
/leakguard init       # Setup complet
/leakguard scan       # Scanează staged files
/leakguard history    # Scanează istoricul
/leakguard fix        # Ghid pentru credential leak
```

---

### Cursor

**Instalare regulă per-proiect:**
```bash
mkdir -p .cursor/rules
curl -fsSL https://raw.githubusercontent.com/podut/leakguard/main/templates/cursor-rule.mdc \
  > .cursor/rules/leakguard.mdc
```

**Ce face regula:**
- `alwaysApply: true` — activ în toate fișierele, tot timpul
- Cursor nu va scrie niciodată credențiale hardcodate în cod
- Înainte de orice commit sugerat, verifică dacă există secrete

---

### Gemini CLI

**Instalare în proiect (fișier GEMINI.md):**
```bash
curl -fsSL https://raw.githubusercontent.com/podut/leakguard/main/templates/GEMINI.md \
  >> GEMINI.md
```

**Verificare:**
```bash
gemini "adaugă o cheie OpenAI hardcodată în cod"
# Trebuie să refuze și să sugereze process.env
```

---

### VSCode

**Tasks instalate automat de `install.sh`:**
1. `Ctrl+Shift+P` → "Tasks: Run Task"
2. Alege una din:
   - **leakguard: Setup** — configurare inițială
   - **leakguard: Scan Staged Files** — scanare manuală
   - **leakguard: Scan Git History** — scanare istorică

---

### GitHub Copilot / Windsurf / Aider / Continue.dev

Creează un fișier de instrucțiuni cu conținutul din `templates/CLAUDE.md`:

| Editor | Fișier instrucțiuni |
|---|---|
| Claude Code | `CLAUDE.md` |
| Gemini CLI / Antigravity | `GEMINI.md` |
| Cursor | `.cursor/rules/leakguard.mdc` |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Windsurf | `.windsurf/rules/leakguard.md` |
| Aider | `.aider.conf.yml` → `system-prompt:` |
| Continue.dev | `.continuerc.json` → `systemMessage:` |

---

## Integrare Keeper Secret Manager

Keeper stochează cheile SSH în vault și le folosește pentru semnarea commit-urilor.

### Prerechizituri
1. Cont Keeper Business sau Personal cu Secrets Manager activat
2. O aplicație KSM creată în Keeper Vault

### Setup pas cu pas

**1. Instalează KSM CLI:**
```bash
npm install -g @keepersecurity/secrets-manager-cli
```

**2. Creează aplicația în Keeper Vault:**
- Vault → Secrets Manager → Applications → New Application
- Dă acces la folderul cu cheile SSH
- Generează un One-Time Token

**3. Inițializează KSM:**
```bash
ksm init default <YOUR_ONE_TIME_TOKEN>
```

**4. Rulează setup:**
```bash
node cli.js init
# → alege "y" la întrebarea despre Keeper
```

**5. Configurează Git pentru semnare SSH:**
```bash
git config --global gpg.format ssh
git config --global user.signingkey "$(cat ~/.ssh/id_ed25519.pub)"
git config --global commit.gpgsign true
```

**6. Verificare:**
```bash
git log --show-signature -1
# → Good "git" signature for user@email.com
```

---

## Scanare istorică și remediere

Dacă ai deja credențiale în istoricul git:

```bash
# 1. Scanează istoricul
node cli.js history

# 2. Revocă imediat credențialele expuse

# 3. Curăță istoricul (necesită git-filter-repo)
pip install git-filter-repo
git filter-repo --invert-paths --path src/config.ts

# 4. Force-push
git push --force-with-lease

# 5. Notifică toți colaboratorii să re-cloneze repo-ul
```

**Dacă repo-ul e public:** presupune că secretul e deja compromis chiar dacă îl ștergi din istoric. Rotește imediat.

---

## Structura proiectului

```
leakguard/
├── cli.js                          # Entry point: node cli.js <command>
├── package.json
├── install.sh                      # Installer POSIX (macOS / Linux / WSL)
├── install.ps1                     # Installer Windows (PowerShell 5.1+)
├── scanners/
│   └── secrets.js                  # Regex patterns pentru 15+ tipuri de credențiale
├── hooks/
│   └── pre-commit                  # Hook instalat în .git/hooks/pre-commit
├── setup/
│   ├── init.js                     # Setup interactiv one-command
│   └── scan-history.js             # Scanner retroactiv pentru git history
├── integrations/
│   └── keeper.js                   # Wrapper pentru Keeper Secret Manager API
├── templates/
│   ├── CLAUDE.md                   # Template instrucțiuni Claude Code
│   ├── GEMINI.md                   # Template instrucțiuni Gemini CLI + Antigravity
│   ├── cursor-rule.mdc             # Template regulă Cursor
│   └── .env.template               # Template pentru variabile de mediu
├── .claude/
│   └── commands/
│       └── gitkeeper.md            # Skill pentru Claude Code (/leakguard)
├── .cursor/
│   └── rules/
│       └── gitkeeper.mdc           # Regulă Cursor (alwaysApply: true)
└── .vscode/
    ├── tasks.json                  # Task-uri pentru VSCode
    └── extensions.json
```

---

## FAQ

**Q: Cum bypass-uiesc hook-ul pentru un commit legitim?**
```bash
LEAKGUARD_BYPASS=1 git commit -m "message"
```
Nu recomandat. Dacă ai un secret legitim în cod, mută-l în `.env`.

**Q: Hook-ul blochează fișiere `.env.example` sau teste?**
Nu — fișierele `.env.example`, `.env.template`, și `node_modules/` sunt excluse automat.

**Q: Funcționează pe Windows?**
Da, hook-ul pre-commit este un script Node.js și rulează pe orice platformă cu Node ≥ 18.

**Q: Pot adăuga pattern-uri proprii?**
Da — editează `scanners/secrets.js` și adaugă în array-ul `PATTERNS`:
```javascript
{ name: "My Custom Pattern", regex: /your-regex-here/g },
```

**Q: Ce fac dacă KSM CLI nu e disponibil?**
Hook-ul și scannerul funcționează independent de Keeper. Integrarea KSM e opțională.

---

## Licență

MIT — folosește, modifică, distribuie liber.
