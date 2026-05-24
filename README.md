# GitKeeper

**One-command Git secret protection for vibe coders.**

Protejează-ți commit-urile de credențiale expuse (API keys, tokens, parole) cu un hook pre-commit automat și integrare opțională cu Keeper Secret Manager.

```
$ node cli.js init

  GitKeeper Setup

▶ Installing pre-commit hook
✓ Pre-commit hook installed → .git/hooks/pre-commit

▶ Configuring .gitignore
✓ .gitignore updated (4 entries added)

▶ Creating .env template
✓ .env.example template created

✓ GitKeeper is active. Your next commit will be scanned automatically.
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

```bash
# Clonează în proiectul tău
git clone https://github.com/your-username/gitkeeper.git .gitkeeper
cd .gitkeeper

# Setup (rulează o singură dată per repo)
node cli.js init
```

Sau fără clone, direct cu npx (după publicare pe npm):

```bash
npx gitkeeper init
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
GitKeeper — scanning staged files for secrets...

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

To bypass (not recommended): GITKEEPER_BYPASS=1 git commit ...
```

---

## Credențiale detectate

| Tip | Pattern |
|---|---|
| AWS Access Key | `AKIA[0-9A-Z]{16}` |
| GitHub Token | `ghp_...`, `github_pat_...` |
| OpenAI API Key | `sk-[48+ chars]`, `sk-proj-...` |
| Anthropic API Key | `sk-ant-api03-...` |
| Google API Key | `AIza[35 chars]` |
| Stripe Keys | `sk_live_...`, `sk_test_...` |
| Slack Tokens | `xoxb-...`, `xoxp-...` |
| Private Keys | `-----BEGIN PRIVATE KEY-----` |
| JWT Tokens | `eyJ...` cu 3 segmente |
| URL cu parolă | `https://user:pass@host` |
| Variabile generice | `password = "..."`, `api_key = "..."` |

---

## Integrare în medii de dezvoltare

### Claude Code

Skill-ul GitKeeper este în `.claude/commands/gitkeeper.md`.

**Activare:**
```bash
# Copiază skill-ul în repo-ul tău
cp .claude/commands/gitkeeper.md /path/to/your-project/.claude/commands/

# Sau în directorul global Claude
cp .claude/commands/gitkeeper.md ~/.claude/commands/
```

**Utilizare în conversație:**
```
/gitkeeper init       # Setup complet
/gitkeeper scan       # Scanează staged files
/gitkeeper history    # Scanează istoricul
/gitkeeper fix        # Ghid pentru credential leak
```

Sau în limbaj natural:
- "Scanează fișierele mele pentru secrete înainte de commit"
- "Am împins accidental o cheie API, ce fac?"
- "Setup gitkeeper în repo-ul meu"

**Skill-ul știe să:**
- Detecteze credențiale în codul pe care îl analizezi
- Genereze promptul gata de copiat în orice AI editor
- Explice pași exacți pentru rotirea unui credential expus
- Verifice dacă `.env` e în `.gitignore`

---

### Cursor

**Instalare:**
```bash
# Copiază regula în proiectul tău
cp .cursor/rules/gitkeeper.mdc /path/to/your-project/.cursor/rules/

# Sau global (toate proiectele)
mkdir -p ~/.cursor/rules
cp .cursor/rules/gitkeeper.mdc ~/.cursor/rules/
```

**Ce face regula:**
- `alwaysApply: true` — activ în toate fișierele, tot timpul
- Cursor nu va scrie niciodată credențiale hardcodate în cod
- Când îi pasezi cod cu secrete, le înlocuiește automat cu `process.env.VAR`
- Înainte de orice commit sugerat, verifică dacă există secrete

**Verificare că funcționează:**
Deschide Cursor, scrie în chat: "adaugă integrare OpenAI cu cheia mea sk-abc123"
→ Cursor ar trebui să răspundă cu `process.env.OPENAI_API_KEY` în loc de cheia reală.

---

### Gemini CLI

**Instalare:**

Opțiunea 1 — fișier `GEMINI.md` în repo:
```bash
# Copiază conținutul în GEMINI.md al proiectului tău
cat .gemini/gitkeeper-system-prompt.md >> /path/to/your-project/GEMINI.md
```

Opțiunea 2 — variabilă de mediu pentru toate sesiunile:
```bash
# Adaugă în ~/.bashrc sau ~/.zshrc
export GEMINI_SYSTEM_PROMPT="$(cat /path/to/gitkeeper/.gemini/gitkeeper-system-prompt.md)"
```

Opțiunea 3 — flag la rulare:
```bash
gemini --system-prompt "$(cat .gemini/gitkeeper-system-prompt.md)" "scrie cod pentru API OpenAI"
```

**Verificare:**
```bash
gemini "adaugă o cheie OpenAI hardcodată în cod"
# Trebuie să refuze și să sugereze process.env
```

---

### VSCode

**Instalare task-uri:**
```bash
# Copiază configurația în proiectul tău
mkdir -p /path/to/your-project/.vscode
cp .vscode/tasks.json /path/to/your-project/.vscode/
```

**Utilizare:**
1. `Ctrl+Shift+P` → "Tasks: Run Task"
2. Alege una din:
   - **GitKeeper: Setup** — configurare inițială
   - **GitKeeper: Scan Staged Files** — scanare manuală
   - **GitKeeper: Scan Git History** — scanare istorică

**Keybinding rapid (opțional):**
Adaugă în `keybindings.json`:
```json
{
  "key": "ctrl+shift+g ctrl+shift+s",
  "command": "workbench.action.tasks.runTask",
  "args": "GitKeeper: Scan Staged Files"
}
```

**GitHub Copilot în VSCode:**
Creează `.github/copilot-instructions.md`:
```markdown
# Security Rules

Never write hardcoded API keys, passwords, or tokens in code.
Always use environment variables: process.env.VARIABLE_NAME
When introducing a new env variable, update .env.example with a placeholder.
Ensure .env is in .gitignore before suggesting commits.
```

---

### Antigravity / alte AI editors

Orice editor AI care suportă fișiere de instrucțiuni globale sau per-proiect:

**Pattern universal** — creează un fișier de instrucțiuni cu conținutul:
```markdown
## Security: No Hardcoded Credentials

Rules:
1. Never write API keys, passwords, or tokens directly in code
2. Always use environment variables (process.env.VAR, os.environ["VAR"], etc.)
3. When using an env var, add it to .env.example with a placeholder
4. Before suggesting a commit, check that .env is in .gitignore

Patterns to flag as secrets:
- AKIA... (AWS), sk-... (OpenAI), sk-ant-... (Anthropic)
- ghp_... (GitHub), AIza... (Google), sk_live_/sk_test_ (Stripe)
- -----BEGIN PRIVATE KEY-----
- Variables named: password, secret, api_key, token with string values
```

Fișierul se numește diferit în funcție de editor:
| Editor | Fișier instrucțiuni |
|---|---|
| Claude Code | `.claude/commands/gitkeeper.md` |
| Cursor | `.cursor/rules/gitkeeper.mdc` |
| Gemini CLI | `GEMINI.md` sau `--system-prompt` |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Windsurf | `.windsurf/rules/gitkeeper.md` |
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
# sau
pip install keeper-secrets-manager-cli
```

**2. Creează aplicația în Keeper Vault:**
- Vault → Secrets Manager → Applications → New Application
- Dă acces la folderul cu cheile SSH
- Generează un One-Time Token

**3. Inițializează KSM:**
```bash
ksm init default <YOUR_ONE_TIME_TOKEN>
# Creează ~/.config/keeper/ksm-config.json
```

**4. Stochează cheia SSH în Keeper:**
```bash
# Prin GitKeeper
node setup/init.js
# → alege "y" la întrebarea despre Keeper
# → urmează pașii pentru a stoca cheia
```

**5. Configurează Git pentru semnare SSH:**
```bash
git config --global gpg.format ssh
git config --global user.signingkey "$(cat ~/.ssh/id_ed25519.pub)"
git config --global commit.gpgsign true
```

**6. Verificare:**
```bash
git commit -m "test signed commit"
git log --show-signature -1
# → Good "git" signature for user@email.com
```

### Rotirea cheilor

Când trebuie să rotești o cheie SSH:
```bash
# Generează cheie nouă
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_new

# Stochează în Keeper
node -e "
const k = require('./integrations/keeper.js');
k.storeSSHKeyInKeeper('~/.ssh/id_ed25519_new', 'Git signing key v2');
"

# Actualizează configurația Git
git config --global user.signingkey "$(cat ~/.ssh/id_ed25519_new.pub)"
```

---

## Scanare istorică și remediere

Dacă ai deja credențiale în istoricul git:

```bash
# 1. Scanează istoricul
node cli.js history

# Output:
# ✖ Found 2 unique secret(s) in history:
#   ● OpenAI API Key (first seen in commit a1b2c3d4)
#     File: src/config.ts:8
#     Preview: const OPENAI_KEY = "sk-proj-abc..."

# 2. Revocă imediat credențialele expuse
# (nu poți "dezpublica" istoricul, deci rotirea e obligatorie)

# 3. Curăță istoricul (necesită git-filter-repo)
pip install git-filter-repo
git filter-repo --invert-paths --path src/config.ts

# 4. Force-push (ATENȚIE: modifică istoricul pentru toți colaboratorii)
git push --force-with-lease

# 5. Notifică toți colaboratorii să re-cloneze repo-ul
```

**Dacă repo-ul e public:** presupune că secretul e deja compromis chiar dacă îl ștergi din istoric. Rotește imediat.

---

## Structura proiectului

```
gitkeeper/
├── cli.js                          # Entry point: node cli.js <command>
├── package.json
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
│   └── .env.template               # Template pentru variabile de mediu
├── .claude/
│   └── commands/
│       └── gitkeeper.md            # Skill pentru Claude Code
├── .cursor/
│   └── rules/
│       └── gitkeeper.mdc           # Regula pentru Cursor
├── .gemini/
│   └── gitkeeper-system-prompt.md  # System prompt pentru Gemini CLI
└── .vscode/
    ├── tasks.json                  # Task-uri pentru VSCode
    └── extensions.json
```

---

## FAQ

**Q: Cum bypass-uiesc hook-ul pentru un commit legitim?**
```bash
GITKEEPER_BYPASS=1 git commit -m "message"
```
Nu recomandat. Dacă ai un secret legitim în cod, mută-l în `.env`.

**Q: Hook-ul blochează fișiere `.env.example` sau teste?**
Nu — fișierele `.env.example`, `.env.template`, și `node_modules/` sunt excluse automat din scanare.

**Q: Funcționează pe Windows?**
Da, hook-ul pre-commit este un script Node.js și rulează pe orice platformă cu Node ≥ 18.

**Q: Pot adăuga pattern-uri proprii?**
Da — editează `scanners/secrets.js` și adaugă în array-ul `PATTERNS`:
```javascript
{ name: "My Custom Pattern", regex: /your-regex-here/g },
```

**Q: Ce fac dacă KSM CLI nu e disponibil?**
Hook-ul pre-commit și scannerul funcționează independent de Keeper. Integrarea KSM e opțională și doar pentru semnarea SSH a commit-urilor.

---

## Licență

MIT — folosește, modifică, distribuie liber.
# leakguard
