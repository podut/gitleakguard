# Security Tools — Raport Skills

Fiecare tool de mai jos poate fi implementat ca skill (similar cu `gitleakguard`)
și instalat cu `npx skills add podut/gitleakguard --skill <name>`.

---

## Comparație rapidă

| Tool | Categorie | Limbaj/Target | Trigger automat |
|---|---|---|---|
| **gitleakguard** | Secrets în git | Orice | Pre-commit, pre-push |
| **gitleaks** | Secrets în git | Orice | Pre-commit, pre-push |
| **njsscan** | SAST securitate | Node.js / JS / TS | La review fișier |
| **retire** | Dependențe vulnerabile | npm / yarn | La `npm install` |
| **semgrep** | SAST avansat | 30+ limbaje | La review cod / PR |
| **yarn-test** | Teste | JS / TS | Pre-commit, pre-push |
| **build-image** | Docker build | Dockerfile | La deploy |
| **trivy** | Vulnerabilități container | Docker / IaC | Post-build, pre-deploy |

---

## 1. gitleaks

**Ce face:** Scanner de secrete cu 150+ reguli pentru toți providerii majori.
**Diferență față de gitleakguard:** Gitleaks e mai cuprinzător (AWS, GCP, Azure, AI APIs, payment, messaging). Gitleakguard e mai simplu de instalat (Node.js, fără dependențe externe).
**Valoare ca skill:** Rulează `gitleaks protect --staged` înainte de orice commit. Blochează dacă găsește secrete. Complementar cu gitleakguard.
**Instalare tool:** `brew install gitleaks` / Docker
**Trigger:** orice menționare de commit, push, deploy
**Overlap cu gitleakguard:** Mare — amândouă fac același lucru, gitleaks cu mai multe reguli

---

## 2. njsscan

**Ce face:** Analiză statică de securitate pentru cod Node.js/JavaScript/TypeScript. Găsește vulnerabilități OWASP în codul sursă (nu în dependențe).
**Valoare ca skill:** Scanează fișierele JS/TS la fiecare review sau înainte de PR. Detectează SQL injection, XSS, command injection, crypto slab, path traversal, prototype pollution — direct în codul scris de developer.
**Instalare tool:** `pip install njsscan` sau Docker
**Trigger:** deschiderea/editarea oricărui fișier `.js`, `.ts`, `.mjs`
**Overlap cu gitleakguard:** Mic — njsscan găsește vulnerabilități logice, gitleakguard găsește credențiale

---

## 3. retire

**Ce face:** Verifică dependențele npm/yarn față de baza de date CVE RetireJS. Identifică pachete cu vulnerabilități cunoscute.
**Valoare ca skill:** Avertizează când se adaugă un pachet vulnerabil (`npm install X`), verifică automat `package.json` la fiecare commit. Complementar cu `npm audit`.
**Instalare tool:** `npm install -g retire` sau folosește `npm audit` (built-in)
**Trigger:** `npm install`, `yarn add`, modificare `package.json`, pre-push
**Overlap cu gitleakguard:** Mic — retire găsește CVE-uri în pachete, gitleakguard găsește credențiale

---

## 4. semgrep

**Ce face:** Analiză statică avansată cu reguli semantice. Înțelege structura codului (nu doar text). Suportă 30+ limbaje. Reguli custom posibile.
**Valoare ca skill:** Cel mai puternic tool pentru review de cod — detectează anti-pattern-uri de securitate, bug-uri logice, probleme de calitate. Ideal pentru PR reviews automate.
**Instalare tool:** `pip install semgrep` sau `brew install semgrep`
**Trigger:** PR review, code review, orice fișier modificat
**Overlap cu gitleakguard:** Mic — semgrep găsește vulnerabilități logice și pattern-uri, gitleakguard găsește credențiale

---

## 5. yarn-test

**Ce face:** Rulează suite-ul de teste cu yarn/npm înainte de commit sau push.
**Valoare ca skill:** Simplu dar important — blochează commit-ul dacă testele pică. Reamintește să scrii teste pentru cod nou. Poate verifica și coverage-ul.
**Instalare tool:** Built-in (yarn/npm)
**Trigger:** orice menționare de commit, push, merge, deploy
**Overlap cu gitleakguard:** Zero — complementar, acoperă calitate cod nu securitate credențiale

---

## 6. build-image

**Ce face:** Validează Dockerfile, construiește imaginea Docker, verifică că `.dockerignore` există, avertizează despre secrete în build args/ENV.
**Valoare ca skill:** Previne greșeli comune Docker — secrete în ENV, rulare ca root, lipsa .dockerignore, tag `latest` pe baza image. Ghidează workflow-ul complet build → scan → push.
**Instalare tool:** Docker (built-in)
**Trigger:** orice menționare de docker build, build image, deploy container
**Overlap cu gitleakguard:** Mic — build-image verifică secrete în Dockerfile, gitleakguard în codul sursă

---

## 7. trivy

**Ce face:** Scanner complet pentru containere, filesystem, IaC (Dockerfile, Kubernetes, Terraform). Găsește CVE-uri în pachete OS și limbaje, misconfigurations, și secrete în layerele imaginii.
**Valoare ca skill:** Esențial înainte de orice deploy. Găsește CVE-uri în imagini Docker pe care `npm audit` nu le vede (pachete Alpine/Ubuntu). Scanează și Dockerfile pentru misconfigs.
**Instalare tool:** `brew install trivy` / Docker / GitHub Action
**Trigger:** după `docker build`, înainte de `docker push` sau deploy
**Overlap cu gitleakguard:** Mic — trivy scanează containere și IaC, gitleakguard scanează codul sursă git

---

## Recomandare implementare

### Prioritate înaltă (complement direct la gitleakguard)

1. **trivy** — acoperă containerele, gitleakguard acoperă codul sursă → împreună acoperă tot
2. **semgrep** — cel mai puternic SAST, detectează vulnerabilități pe care gitleakguard nu le vede
3. **yarn-test** — simplu, valoros, zero overlap

### Prioritate medie

4. **njsscan** — util pentru proiecte Node.js, dar semgrep face mai mult
5. **retire** — `npm audit` e deja built-in, retire e redundant în multe cazuri

### Prioritate scăzută

6. **gitleaks** — overlap mare cu gitleakguard, nu merită skill separat
7. **build-image** — mai mult workflow guide decât security tool

### Stack recomandat pentru un proiect Node.js complet

```
gitleakguard  → secrete în git (pre-commit)
semgrep       → vulnerabilități în cod (pre-push / PR review)
trivy         → vulnerabilități în container (post-build)
yarn-test     → teste (pre-commit)
```

Instalare stack complet:
```bash
npx skills add podut/gitleakguard --skill gitleakguard
npx skills add podut/gitleakguard --skill semgrep
npx skills add podut/gitleakguard --skill trivy
npx skills add podut/gitleakguard --skill yarn-test
```
