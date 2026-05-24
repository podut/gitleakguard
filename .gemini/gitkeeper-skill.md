# GitKeeper — Protecție Git împotriva credențialelor expuse

Detectează și blochează API keys, tokens, parole și orice credențiale hardcodate înainte să ajungă în git history.

---

## CÂND SĂ RULEZI ACEST SKILL

- Utilizatorul cere "scanează pentru secrete", "setup gitkeeper", "verifică înainte de commit"
- Utilizatorul spune că a împins accidental o cheie API sau un token
- Se adaugă integrări noi (OpenAI, Stripe, AWS, Firebase, etc.)
- Se face commit sau push și există risc de credențiale expuse

---

## MODURI DE EXECUȚIE

### MOD 1: Setup (`/gitkeeper init` sau "setup gitkeeper în repo-ul meu")

1. Verifică dacă suntem într-un repo git: `git rev-parse --git-dir`
2. Verifică dacă hook-ul e instalat: `ls .git/hooks/pre-commit`
3. Dacă lipsește, instalează-l:
   ```bash
   cp /path/to/gitkeeper/hooks/pre-commit .git/hooks/pre-commit
   chmod +x .git/hooks/pre-commit
   ```
4. Verifică `.gitignore` — trebuie să conțină: `.env`, `.env.local`, `*.pem`, `*.key`
5. Dacă lipsesc, adaugă-le în `.gitignore`
6. Creează `.env.example` dacă nu există
7. Raportează ce s-a configurat

### MOD 2: Scanare fișiere staged (`/gitkeeper scan` sau "scanează fișierele mele")

Obține fișierele staged:
```bash
git diff --cached --name-only --diff-filter=ACM
```

Pentru fiecare fișier, caută pattern-uri de tip:
AWS (`AKIA...`), GitHub (`ghp_...`), OpenAI (`sk-proj-...`), Anthropic (`sk-ant-api...`),
Google (`AIza...`), Stripe (`sk_live_...`, `sk_test_...`), Slack (`xoxb-...`),
Private Keys (`-----BEGIN PRIVATE KEY-----`), JWT (`eyJ...`),
URL cu parolă (`https://user:pass@...`),
Variabile generice: `password = "..."`, `api_key = "..."`, `secret = "..."` cu valori reale.

Raportează: fișier, linie, tip de secret, preview.

### MOD 3: Scanare istorică (`/gitkeeper history` sau "verifică tot istoricul git")

```bash
git log --all --format=%H
```

Pentru fiecare commit verifică fișierele modificate cu aceleași pattern-uri.
Deduplicare: același secret raportat o singură dată (primul commit în care a apărut).

### MOD 4: Remediere urgentă (`/gitkeeper fix` sau "am împins accidental o cheie")

**Pasul 1 — Revocă IMEDIAT:**
- OpenAI: platform.openai.com → API Keys → Revoke
- Anthropic: console.anthropic.com → API Keys → Delete
- GitHub: Settings → Developer Settings → Tokens → Delete
- AWS: IAM Console → Security Credentials → Deactivate
- Stripe: dashboard.stripe.com → Developers → Roll Key
- Google: console.cloud.google.com → APIs → Credentials → Delete

**Pasul 2 — Mută în `.env` și înlocuiește în cod:**
```js
// Înainte (greșit)
const apiKey = "sk-proj-abc123...";

// După (corect)
const apiKey = process.env.OPENAI_API_KEY;
```

**Pasul 3 — Curăță istoricul dacă a fost push:**
```bash
pip install git-filter-repo
git filter-repo --invert-paths --path src/fisierul-cu-secretul.js
git push --force-with-lease
```

---

## PROMPT AI GATA DE COPIAT

Când găsești secrete, oferă întotdeauna:

```
Caută toate credențialele hardcodate din proiect (API keys, tokens, parole, connection strings).
Pentru fiecare:
1. Mută valoarea în .env ca VARIABLE_NAME=value
2. Asigură-te că .env e în .gitignore
3. Înlocuiește în cod cu process.env.VARIABLE_NAME
4. Adaugă în .env.example: VARIABLE_NAME=your_value_here (fără valori reale)
```

---

## REGULI PREVENTIVE

Când generezi cod care necesită un API key, token sau parolă:
- NICIODATĂ nu scrie valori reale în cod
- ÎNTOTDEAUNA folosește variabile de mediu: `process.env.VAR`, `os.environ["VAR"]`, etc.
- Dacă utilizatorul îți dă o cheie reală în mesaj — nu o reproduce în cod
- Adaugă automat în `.env.example` orice variabilă nouă introdusă

---

## OUTPUT AȘTEPTAT

```
● [Tip Secret]
  Fișier: src/api.js:14
  Preview: apiKey: "sk-proj-abc123..."
  Acțiune: Mută în .env ca OPENAI_API_KEY=valoarea
```

Dacă nu s-au găsit secrete: `✓ Niciun secret detectat. Commit sigur.`

Încheie întotdeauna cu acțiunea concretă pe care trebuie să o facă utilizatorul acum.
