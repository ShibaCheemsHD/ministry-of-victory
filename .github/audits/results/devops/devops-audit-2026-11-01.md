# Audit DevOps — Ministry of Victory

Data: 1 novembre 2026 · Commit: `0fbff4a` · Sola lettura (nessuna modifica al codice)

## Come va in produzione oggi

| Pezzo | Come | Dove |
|-------|------|------|
| Pagina | `index.html` generato da `tools/build.py` e committato su `main`; GitHub Pages pubblica dal branch | `tools/build.py`, workflow "pages build and deployment" (gestito da GitHub) |
| Test | Ad ogni push su `main`: build `--check`, test node, sintassi del registratore, pagina in 60+ scenari, accessibilità (~9 min) | `.github/workflows/test.yml` |
| Registratore | Un run da ~5 h 40 min con uno snapshot ogni 10 min; a fine run rilancia se stesso; cron ogni 2 h come riserva | `.github/workflows/record.yml` |
| Monitoraggio | Ogni ora legge `intel.json` e apre/aggiorna/chiude un'issue "Recorder health" | `.github/workflows/health.yml`, `tools/health.py` |
| Probe | Manuale, salva risposte delle API su un branch `probe` | `.github/workflows/probe.yml` |

## Risultati

| ID | Gravità | Tema | Dove |
|----|---------|------|------|
| OPS-01 | **Alta** | I test non bloccano la pubblicazione: un commit rotto va online anche se i test falliscono | Pages da branch; `test.yml` gira in parallelo |
| OPS-02 | **Alta** | Node 20 è a fine vita (30 aprile 2026) e lo usano tutti i workflow | `.github/workflows/test.yml:22`, `record.yml:29`, `probe.yml:24` |
| OPS-03 | Media | Rilascio del registratore manuale (annulla + rilancia): 21 run annullati sugli ultimi 30 | `record.yml:24-37` (vedi ARCH-03) |
| OPS-04 | Media | Nessun backup dello stato del registratore | `record.yml:41-44` (vedi ARCH-01/02) |
| OPS-05 | Media | Uso continuo delle Actions 24/7 per raccogliere dati: rischio rispetto alle condizioni d'uso di GitHub | `record.yml` |
| OPS-06 | Bassa | Nessuna protezione del branch `main` né aggiornamenti automatici delle dipendenze | impostazioni repo |
| OPS-07 | Bassa | L'allarme di salute non avvisa nessuno attivamente | `health.yml:30-43` |
| OPS-08 | Bassa | Gli errori del registratore restano solo nei log delle Actions (90 giorni) | `record.yml:45-47` |

### OPS-01 — La pubblicazione non aspetta i test (Alta)
GitHub Pages pubblica `index.html` dal branch `main` appena arriva il push, mentre `test.yml` impiega circa 9 minuti. Se un test fallisce, la pagina rotta è già online. Finora non è successo solo perché i test girano in locale prima di ogni push.
**Rimedio**: pubblicare con `actions/upload-pages-artifact` + `actions/deploy-pages` come ultimo job di `test.yml` (`needs: test`), e impostare Pages su "GitHub Actions" come sorgente. In alternativa: lavorare su branch e unire su `main` solo con i check verdi.

### OPS-02 — Node 20 fuori supporto (Alta)
Node.js 20 ha raggiunto la fine del supporto il 30 aprile 2026: niente più correzioni di sicurezza. Lo usano il registratore (che gira 24 ore su 24 e legge contenuti esterni), i test e il probe.
**Rimedio**: `node-version: 22` (LTS fino ad aprile 2027) o 24. Il codice usa solo API standard (`fetch`, `AbortSignal.timeout`, `node:test`), quindi il passaggio dovrebbe essere indolore; i test lo confermano.

### OPS-03 — Rilasci del registratore a mano (Media)
Ogni modifica a `recorder/` richiede di annullare il run in corso e rilanciarlo (21 annullati sugli ultimi 30 run, quasi tutti per questo). Un run schedulato con il codice vecchio può anche restare in coda davanti al nuovo (successo il 31 ottobre).
**Rimedio**: vedi ARCH-03 (il ciclo esce da solo quando `main` cambia), o un job su push a `recorder/**` che annulla il run in corso e lo rilancia.

### OPS-04 — Stato senza backup (Media)
Duplicato operativo di ARCH-01/02: uno storico vuoto può sovrascrivere quello vero, e non esiste copia della versione precedente.
**Rimedio**: vedi ARCH-01/02.

### OPS-05 — Actions sempre accese (Media)
Il registratore occupa un runner 24 ore su 24. Nei repository pubblici i minuti sono gratuiti, ma le condizioni di GitHub chiedono che le Actions servano a costruire, testare o pubblicare il software del progetto, e un uso continuo per raccogliere dati può essere segnalato. Se GitHub disattivasse le Actions del repo, si fermerebbero insieme registratore, test e controllo di salute.
**Rimedio**: tenere il consumo al minimo utile (uno snapshot ogni 10 min va bene; evitare di allungare i run), e avere un piano B pronto (es. un worker gratuito di Cloudflare o un piccolo VPS che scrive sullo stesso branch).

### OPS-06 — Nessuna protezione di `main`, nessun Dependabot (Bassa)
`main` non è protetto (`protected: false`): si può pushare senza test e anche forzare la storia. Le action e le versioni pinnate (`esbuild@0.24.0`, `playwright==1.48.0`, `axe-core@4.10.2`) non vengono mai aggiornate.
**Rimedio**: protezione di `main` con il check "Tests" richiesto (insieme a OPS-01); un `dependabot.yml` per `github-actions`.

### OPS-07 — L'allarme non suona (Bassa)
Il controllo di salute apre un'issue, ma nessuno riceve un avviso se non segue il repository con le notifiche attive.
**Rimedio**: assegnare l'issue al proprietario (`--assignee`), così arriva una notifica email di GitHub.

### OPS-08 — Log del registratore effimeri (Bassa)
Gli avvisi (`::warning::`) restano solo nei log delle Actions. Per capire a posteriori perché una misura manca, non c'è uno storico degli errori.
**Rimedio**: tenere in `hist.health` gli ultimi 50 errori con l'ora (la struttura esiste già, `recorder/record.mjs`).

## Cose a posto

- Build riproducibile, con controllo di allineamento dei file generati in CI.
- Test ampi e veloci per un progetto di questa taglia (~9 min), con regressioni per i bug già visti.
- Il registratore non dipende dal cron di GitHub (si rilancia da solo), e ha una riserva.
- Monitoraggio della salute delle fonti con chiusura automatica dell'issue quando tutto torna a posto.
- Nessun segreto oltre al `GITHUB_TOKEN` automatico.

## Conteggio

| Gravità | N. |
|---------|----|
| Critica | 0 |
| Alta | 2 |
| Media | 3 |
| Bassa | 3 |

Confidenza: alta per OPS-01, OPS-02, OPS-03 (verificati su workflow, date di fine vita e storico dei run); media per gli altri.
