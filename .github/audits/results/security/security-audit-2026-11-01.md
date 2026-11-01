# Audit di sicurezza — Ministry of Victory

Data: 1 novembre 2026 · Commit: `0f962e8` · Sola lettura (nessuna modifica al codice)

## Superficie

Il sito non ha login, account, backend né dati personali: è una pagina statica (GitHub Pages) che legge dati pubblici. I rischi reali sono quindi due:

1. **Contenuti di terzi eseguiti come codice** nella pagina (XSS): la pagina mostra testi che arrivano da fonti esterne, alcune lette e ripubblicate dal registratore (API della community, API del gioco, registro di guerra di CrossWaveOmega su GitHub, pagine di helldiversstats.com, liste di nomi su GitHub).
2. **Le GitHub Actions**, che hanno permessi di scrittura sul repository.

## Risultati

| ID | Gravità | Tema | Dove |
|----|---------|------|------|
| SEC-01 | **Alta** | XSS: testi di terzi passano da `innerHTML` (anche se l'elemento non è nella pagina) | `src/app/09-motion-interaction.js:205`, chiamate in `src/app/08-view-archive.js:69,83,172,190,199,210`, `src/app/01-intel.js:284` |
| SEC-02 | Media | Nessuna Content-Security-Policy: un'iniezione riuscita non trova ostacoli | `tools/build.py:12-30` |
| SEC-03 | Media | Iniezione di comandi shell nel workflow di probe tramite l'input `urls` | `.github/workflows/probe.yml:28` |
| SEC-04 | Bassa | Actions referenziate per tag (`@v4`), non per hash del commit | `.github/workflows/*.yml` |
| SEC-05 | Bassa | Il token della Action viaggia nell'URL di `git push` | `.github/workflows/record.yml:44`, `.github/workflows/probe.yml` |
| SEC-06 | Bassa | Dati del registratore accettati senza alcun controllo di forma | `src/app/01-intel.js:25-60`, `src/app/08-view-archive.js` |

### SEC-01 — Testi esterni interpretati come HTML (Alta, verificato)
La funzione `plain()` (`09-motion-interaction.js:205`) toglie i tag a una stringa così:
`const d = document.createElement('div'); d.innerHTML = html; return d.textContent…`.
Anche se il `div` non viene mai aggiunto alla pagina, il browser interpreta l'HTML ed **esegue gli handler** come `onerror` delle immagini. `plain()` è usata (direttamente o tramite `titleCase()`) su testi grezzi che non sono stati prima resi innocui:
- nomi e briefing degli ordini nell'archivio (`08-view-archive.js:69,83`) — vengono dal registro di guerra di CrossWaveOmega, da helldiversstats.com e dall'API;
- nomi dei pianeti nell'archivio (`08-view-archive.js:190,199,210`);
- titoli degli ordini nel riquadro "Checked live" (`08-view-archive.js:172`);
- titoli delle notizie nel registro del Comando (`01-intel.js:284`, passano da `splitDispatch`, che toglie i tag: rischio minore).

**Prova**: con l'API finta dei test, mettendo come nome di un ordine `<img src=x onerror="window.__pwn=1">` e aprendo l'Archivio, lo script viene eseguito (`window.__pwn === 1`). Basta quindi che una delle fonti esterne contenga del markup (per errore o perché compromessa), e il registratore lo ripubblica sul branch `data`, da cui ogni visitatore lo carica.
**Impatto**: esecuzione di codice sul dominio del sito per tutti i visitatori (redirect, defacement, mining). Nessun dato personale o sessione da rubare, il che limita il danno ma non lo annulla.
**Rimedio** (piccolo): in `plain()` usare un parser inerte, `new DOMParser().parseFromString(html, 'text/html').body.textContent` (verificato: non esegue `onerror`), oppure togliere i tag con una regex. In più, escapare sempre i testi esterni prima di passarli a qualsiasi funzione che produce HTML.

### SEC-02 — Nessuna CSP (Media)
La pagina non dichiara una Content-Security-Policy (`tools/build.py` costruisce l'`<head>` senza `<meta http-equiv="Content-Security-Policy">`). GitHub Pages non permette header personalizzati, ma il meta funziona per `script-src`, `connect-src`, `img-src`. Con gli hash degli script inline calcolati in build (e senza `'unsafe-inline'`), anche un'iniezione come SEC-01 non potrebbe eseguire handler inline.
**Rimedio**: in `build.py` calcolare `sha256` di ogni `<script>` e scrivere una CSP con `script-src 'sha256-…'`, `connect-src` limitato a `api.helldivers2.dev`, `raw.githubusercontent.com`, `api.live.prod.thehelldiversgame.com` (se usato), `img-src 'self' data: blob:`, `style-src 'self' 'unsafe-inline' fonts.googleapis.com`, `font-src fonts.gstatic.com`.

### SEC-03 — Iniezione nel workflow di probe (Media)
`probe.yml:28` inserisce l'input nel comando shell: `URLS="${{ inputs.urls }}" node …`. Un input con `"` e `;` esegue comandi arbitrari nel runner, che ha `contents: write`. Solo chi ha accesso in scrittura al repo può lanciare il workflow, quindi oggi il rischio è basso in pratica; diventa reale se si aggiungono collaboratori.
**Rimedio**: passare l'input come variabile d'ambiente (`env: URLS: ${{ inputs.urls }}`) e usare `"$URLS"` nello script.

### SEC-04 — Actions per tag (Bassa)
`actions/checkout@v4`, `setup-node@v4`, `setup-python@v5` sono referenziate per tag, che il proprietario può spostare. Sono action ufficiali GitHub, quindi il rischio è basso.
**Rimedio**: fissarle all'hash completo del commit, con il tag in commento.

### SEC-05 — Token nell'URL di push (Bassa)
`git push "https://x-access-token:${TOKEN}@github.com/…"`. GitHub maschera il segreto nei log, ma un messaggio d'errore di git o un `set -x` futuro potrebbero esporlo altrove.
**Rimedio**: usare `actions/checkout` con le credenziali persistite o `git -c http.extraheader="AUTHORIZATION: bearer $TOKEN"`.

### SEC-06 — Dati del registratore senza controllo di forma (Bassa)
La pagina usa i JSON del branch `data` come arrivano. Un JSON malformato o con tipi inattesi (per un bug del registratore) può rompere la pagina; insieme a SEC-01 può portare markup nel DOM.
**Rimedio**: un controllo minimo dei campi usati (tipi, lunghezze) al caricamento, e ignorare il file se non torna.

## Cose controllate e a posto

- Nessun segreto nel repository (ricerca di token GitHub, chiavi AWS, chiavi private: nessun risultato).
- Permessi delle Actions minimi per ciascun workflow (`test.yml` solo lettura; `record.yml` scrittura contenuti + actions; `health.yml` issues).
- Il controllo di salute crea le issue con `--body-file`, senza interpolare testo nel comando.
- L'email dell'utente non è inviata a nessun servizio; il contatto per l'API è generico (`ministry-of-victory-user`).
- I testi dei dispacci passano da `splitDispatch` (tag rimossi) e poi da `esc()` prima del rendering; i nomi di nemici e armi da liste esterne sono escapati.

## Conteggio

| Gravità | N. |
|---------|----|
| Critica | 0 |
| Alta | 1 |
| Media | 2 |
| Bassa | 3 |

Confidenza: alta per SEC-01 (riprodotto), SEC-03 (pattern noto, verificato sul file); media per gli altri.
