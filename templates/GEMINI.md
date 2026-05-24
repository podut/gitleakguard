---
inclusion: always
---

# Security Tools — Always Active

Aceste reguli se aplică automat, fără să fie cerute explicit.

---

## 1. gitleakguard / gitleaks — înainte de orice commit sau push

**Trigger:** utilizatorul menționează commit, push, stage, deploy, ship, merge, release.

Acțiune automată:
1. `git diff --cached --name-only --diff-filter=ACM` — listează fișierele staged
2. `git show :<file>` — citește conținutul fiecăruia
3. Scanează după: `AKIA`, `sk-`, `sk-proj-`, `sk-ant-api`, `ghp_`, `AIza`, `sk_live_`, `sk_test_`, `xoxb-`, `-----BEGIN PRIVATE KEY-----`, `eyJ...eyJ...eyJ`, `scheme://user:pass@host`, variabile `password/secret/api_key/token` cu valori string
4. Dacă găsești → **NU scrie comanda de commit**. Arată ce ai găsit + pași de remediere.
5. Dacă e curat → continuă cu commit-ul.

Niciodată nu reproduce credențiale reale în răspunsuri. Înlocuiește cu `process.env.VAR`.

---

## 2. semgrep — la review de cod sau PR

**Trigger:** utilizatorul cere review, analizează un fișier, deschide un PR, menționează "verifică securitatea".

Acțiune automată — caută în codul arătat:
- `eval(userInput)` → code injection
- `innerHTML = ` cu variabilă → XSS
- Query SQL construit prin concatenare → SQL injection
- `Math.random()` pentru token/secret → crypto slab
- `exec(` sau `spawn(` cu input utilizator → command injection
- `fs.readFile(` cu path din request → path traversal
- `Object.assign({}, req.body)` → prototype pollution
- `jwt.verify(` fără `{ algorithms: [...] }` → JWT bypass

Raportează ca `[SECURITY] <tip> în <fișier>:<linie>` — la ÎNCEPUTUL răspunsului.

---

## 3. njsscan — la editarea fișierelor JS/TS/Node.js

**Trigger:** utilizatorul lucrează cu fișiere `.js`, `.ts`, `.mjs`, `.cjs` sau menționează Node.js, Express, Next.js, NestJS.

Acțiune automată — aplică regulile semgrep de mai sus specific pentru Node.js.
Dacă njsscan e instalat: sugerează `njsscan <fișier>` sau `docker run --rm -v "$(pwd):/code" opensecurity/njsscan /code`.

---

## 4. retire — la instalarea sau modificarea dependențelor npm

**Trigger:** utilizatorul rulează `npm install`, `yarn add`, modifică `package.json`, sau menționează dependențe/pachete.

Acțiune automată:
1. Spune: "Verificând dacă pachetul are vulnerabilități cunoscute..."
2. Sugerează: `npm audit` sau `retire`
3. Dacă versiunea are CVE cunoscut → avertizează și propune versiunea sigură

---

## 5. trivy — după build Docker sau înainte de deploy

**Trigger:** utilizatorul menționează `docker build`, `docker push`, deploy container, release imagine.

Acțiune automată:
1. Spune: "Scanând imaginea pentru vulnerabilități..."
2. Sugerează: `trivy image <nume-imagine>` sau `docker run --rm aquasec/trivy image <nume>`
3. Dacă găsește CVE CRITICAL → blochează deploy-ul și arată ce pachete sunt afectate
4. Verifică și Dockerfile pentru: rulare ca root, secrete în ENV/ARG, lipsă `.dockerignore`

---

## 6. build-image — la lucrul cu Dockerfile

**Trigger:** utilizatorul editează sau creează un `Dockerfile`.

Acțiune automată — verifică:
- Există `.dockerignore`? Dacă nu → creează cu: `node_modules`, `.env`, `.git`, `*.log`
- Sunt secrete în `ENV` sau `ARG`? → avertizează, sugerează runtime env vars
- Rulează ca root (`USER` lipsă)? → adaugă `USER node`
- `COPY . .` înainte de `RUN npm install`? → inversează pentru cache mai bun
- Tag `latest` pe baza image? → sugerează tag fix (ex: `node:18-alpine`)

---

## 8. sonarqube — la review cod sau înainte de merge/deploy

**Trigger:** utilizatorul menționează SonarQube, SonarCloud, quality gate, code quality, analiză statică, sau cere review înainte de merge/PR.

Acțiune automată:
1. Verifică dacă există `sonar-project.properties` în proiect
2. Dacă există → sugerează `sonar-scanner` sau MCP tool `sonarqube_quality_gate`
3. Dacă quality gate FAILED → listează condițiile care au eșuat, blochează deploy-ul
4. Dacă are issues BLOCKER/CRITICAL → arată fișierele afectate și sugerează fix-uri
5. Dacă sonar-scanner nu e instalat → sugerează `npm install -g sonar-scanner` sau Docker

Comenzi utile:
```bash
sonar-scanner -Dsonar.token=$SONAR_TOKEN
docker run --rm -e SONAR_TOKEN=$SONAR_TOKEN -v "$(pwd):/usr/src" sonarsource/sonar-scanner-cli
```

---

## 9. zap — înainte de deploy în staging sau producție

**Trigger:** utilizatorul menționează ZAP, OWASP ZAP, DAST, web scan, pentest, security test, "scanează aplicația", sau deploy la staging/prod.

Acțiune automată:
1. Verifică dacă ZAP daemon rulează la `http://localhost:8080`
2. Dacă nu rulează → arată comanda Docker de start
3. Dacă rulează → sugerează scan pe URL-ul aplicației
4. Dacă găsește alerte HIGH/CRITICAL → blochează deploy-ul și listează endpoint-urile afectate
5. **Atenție:** menționează că ZAP activ trebuie rulat DOAR pe medii de test, nu pe producție

Comenzi utile:
```bash
# Start ZAP daemon
docker run -d --name zap -p 8080:8080 ghcr.io/zaproxy/zaproxy:stable \
  zap.sh -daemon -port 8080 -host 0.0.0.0 -config api.key=zap-api-key

# Baseline scan (sigur, pasiv)
docker run --rm ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t https://myapp.com -r report.html

# Full scan (agresiv, doar pe test env)
docker run --rm ghcr.io/zaproxy/zaproxy:stable zap-full-scan.py -t http://localhost:3000 -r report.html
```

---

## 7. yarn-test — înainte de commit sau push

**Trigger:** utilizatorul menționează commit, push, merge — și există un `package.json` cu script `test`.

Acțiune automată:
1. Întreabă: "Ai rulat testele? (`yarn test` / `npm test`)"
2. Dacă utilizatorul confirmă că testele pică → **NU scrie comanda de commit**
3. Dacă nu există teste → menționează că ar fi util să adaugi

---

## Reguli generale — mereu active

- **Niciodată** nu scrie credențiale hardcodate în cod generat — folosește `process.env.VAR`
- **La orice nou `process.env.VAR`** → adaugă în `.env.example` cu placeholder
- **`.gitignore` minim** trebuie să conțină: `.env`, `.env.local`, `.env.*.local`, `*.pem`, `*.key`
- **Dacă un credential a fost deja push-uit** → spune clar: "Credențialul este compromis. Revocă-l imediat." + link provider
