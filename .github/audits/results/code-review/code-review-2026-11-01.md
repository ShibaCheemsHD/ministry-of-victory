# Revisione del codice — Ministry of Victory

Data: 1 novembre 2026 · Commit: `b6c3c64` · Sola lettura (nessuna modifica al codice)

Metodo: lettura mirata dei percorsi critici (motore, ciclo di aggiornamento della pagina, registratore, effetti), più un'analisi statica con ESLint 9 (`no-undef`, `no-unused-vars`, `no-unsafe-finally`, `no-unreachable`, `no-dupe-keys`…) sul file della pagina assemblato (`build/app.js`, 3.300 righe) e su `src/engine.js`.

**Esito dell'analisi statica**: nessun riferimento a nomi non definiti (il rischio ARCH-04 oggi è pulito), 1 errore (`no-unsafe-finally`), 10 variabili o funzioni inutilizzate.

## Risultati

| ID | Gravità | Tema | Dove |
|----|---------|------|------|
| CR-01 | Media | Lo storico locale della pagina supera la quota di `localStorage` dopo circa un giorno di pagina aperta, e viene riscritto (MB di JSON) ogni minuto | `src/app/01-intel.js:419-422`, `src/app/00-core.js:17` |
| CR-02 | Media | Uno snapshot del registratore bloccato blocca tutto il run per ore: nessun timeout sul processo | `.github/workflows/record.yml:39` |
| CR-03 | Media | `history.json` cresce senza limite: `hist.calls` e `hist.hs` non vengono mai sfoltiti | `recorder/record.mjs:206-244`, `recorder/hs.mjs:53` |
| CR-04 | Bassa | `return` dentro `finally`: con i dati di avvio (seed) gli errori vengono ingoiati senza essere mostrati | `src/app/01-intel.js:482-483` |
| CR-05 | Bassa | Codice morto: ~130 righe mai usate | `src/app/01-intel.js:216` (`renderIntel`), `src/app/07-history-data.js:380` (`dataHTML`), altre 8 variabili |
| CR-06 | Bassa | Il controllo live dell'affidabilità copre solo "Libera pianeta X", non "Libera N pianeti" né i settori | `recorder/record.mjs:232-236` |
| CR-07 | Bassa | `mergeRecord` confronta ogni campione con tutti gli altri (quadratico) a ogni aggiornamento | `src/app/01-intel.js:58-63` |

### CR-01 — Storico locale oltre la quota (Media)
Ogni minuto la pagina aggiunge un campione (~3,5 KB: tutti i pianeti contesi) e salva fino a 3.000 campioni con `store.set('samples', …)` (`01-intel.js:419-422`). 3.000 × 3,5 KB ≈ 10 MB, oltre i ~5 MB che i browser danno a `localStorage`. Da circa 1.400 campioni (un giorno di pagina aperta) la scrittura fallisce in silenzio (`00-core.js:17`, `catch {}`), e prima di quel punto ogni minuto si serializzano diversi MB nel thread principale (scatti visibili sui telefoni lenti).
**Rimedio**: salvare solo i campioni propri delle ultime 6 ore (quelli del registratore si riscaricano), o salvarne uno ogni 10 minuti; ridurre il formato (solo pianeti degli ordini attivi).

### CR-02 — Nessun timeout sullo snapshot (Media)
`record.yml:39` esegue `node recorder/record.mjs` senza limite di tempo. Le singole richieste hanno timeout, ma un blocco altrove (lettura di un corpo enorme, una promessa mai risolta) ferma il ciclo fino al timeout del job: fino a 5 ore e 50 minuti senza snapshot.
**Rimedio**: `timeout 540 node recorder/record.mjs …` (9 minuti, sotto l'intervallo di 10).

### CR-03 — Crescita senza fine dello stato (Media)
`hist.calls` (una voce per ordine, con fino a 240 previsioni orarie per pianeta) e `hist.hs` (ogni ordine di helldiversstats con la sua serie a 10 minuti) non vengono mai potati. Oggi `history.json` è 1,2 MB, di cui 283 KB di `hs`; in un anno può arrivare a diversi MB, letti e riscritti ogni 10 minuti e scaricati a ogni push.
**Rimedio**: tenere le serie complete solo per gli ultimi 90 giorni e, per gli ordini più vecchi, solo i riassunti che servono all'archivio e all'affidabilità.

### CR-04 — `return` in `finally` (Bassa)
`01-intel.js:483`: `finally { if (seed) { …; return; } … }`. Con i dati di avvio (snapshot salvato o file live del registratore) un errore di rendering finisce in `errors` ma non viene mai mostrato né registrato, e il `return` nel `finally` annulla qualsiasi eccezione. Il refresh vero che segue di solito ripara, ma il problema resta invisibile.
**Rimedio**: spostare il ramo `seed` fuori dal `finally` e almeno registrare `errors` in console.

### CR-05 — Codice morto (Bassa)
`renderIntel` (`01-intel.js:216`) e `dataHTML` (`07-history-data.js:380`, la vecchia scheda "Numbers") non sono più chiamate; inutilizzate anche `dssP`, `idle`, `showSim`, `weapon`, `start`, `CALL_ORDER`, `bootStart`, `a`. Sono circa 130 righe da mantenere senza motivo, e confondono chi legge.
**Rimedio**: rimuoverle e aggiungere ESLint (`no-undef` + `no-unused-vars`) alla CI sul file assemblato.

### CR-06 — Affidabilità live parziale (Bassa)
Il registratore salva le previsioni orarie solo per gli obiettivi di tipo 11 (`record.mjs:232-236`). Gli ordini "Libera N pianeti" (tipo 14) e quelli di settore non entrano mai nel conteggio live, che quindi rappresenta solo una parte delle previsioni mostrate.
**Rimedio**: tracciare anche i pianeti dei bersagli di tipo 14 (`r.libN.rank`).

### CR-07 — Unione quadratica (Bassa)
`mergeRecord` usa `mine.some(...)` per ogni campione del registratore: con 3.000 campioni locali e ~300 del registratore sono ~900.000 confronti a ogni aggiornamento. Oggi costa pochi millisecondi; peggiora insieme a CR-01.
**Rimedio**: confronto su un insieme di tempi arrotondati (`Set`), lineare.

## Cose fatte bene

- Il motore è puro (nessun accesso al DOM o alla rete), testato con casi calcolati a mano, e lo stesso codice gira nella pagina e nel registratore.
- Gli input esterni sono passati da `esc()` in modo coerente nei template (con l'eccezione corretta oggi, SEC-01).
- Le fetch del registratore hanno timeout e ripetizioni; la pagina rispetta il limite di richieste dell'API (finestra scorrevole, `00-core.js:128-150`).
- Ogni bug arrivato in produzione ha il suo test di regressione con data e spiegazione.
- Commenti che spiegano il *perché* (numeri misurati, date, fonti), non il *cosa*.

## Conteggio

| Gravità | N. |
|---------|----|
| Critica | 0 |
| Alta | 0 |
| Media | 3 |
| Bassa | 4 |

Confidenza: alta per CR-01 (misurato: 3,5 KB a campione su `recent.json`), CR-02, CR-04, CR-05 (ESLint); media per CR-03 (proiezione) e CR-07.
