# Audit di architettura — Ministry of Victory

Data: 1 novembre 2026 · Commit: `87f6bb5` · Sola lettura (nessuna modifica al codice)

## Mappa del sistema

```
                 api.helldivers2.dev (community) ── fallback ── API ufficiale del gioco
                              │                                        │
        ┌─────────────────────┴───────────┐              ┌─────────────┴────────────┐
        │ PAGINA (index.html, GitHub Pages)│              │ REGISTRATORE (Actions)   │
        │ src/engine.js  ← stesso motore → │ recorder/engine.cjs (generato da build) │
        │ src/app/00..11 (un'unica IIFE)   │              │ record.mjs ogni 10 min   │
        │ src/i18n.js, style.css, body.html│              │ measure / accuracy /     │
        └──────────────┬───────────────────┘              │ retro / hs / official    │
                       │ legge                            └─────────────┬────────────┘
                       └──── raw.githubusercontent.com/…/data/ ◄────────┘ force-push
                             (history, intel, recent, progress, live, archive .json)
 Fonti esterne: CrossWaveOmega (registro di guerra), helldiversstats.com, GWW + helldivers-2/json (nomi)
```

- **Build** (`tools/build.py`): concatena `src/app/*.js` in ordine in una sola chiusura, minifica con esbuild, genera `index.html`, `recorder/engine.cjs`, `build/test.html` (con API finta). `--check` in CI garantisce che i file generati siano allineati.
- **Stato persistente**: solo il branch `data`, un unico commit riscritto a ogni snapshot.
- **Test**: unit (node:test) su motore, testi, recorder, accuratezza; pagina in browser (Playwright, scenari + dati casuali); accessibilità (axe-core). Tutti in CI.

## Punti di forza

- Un solo motore di calcolo condiviso da pagina e registratore, con controllo di allineamento in CI (`tools/build.py:57-60`).
- Nessun backend da gestire: pagina statica + Action; i costi sono zero e la superficie d'attacco è piccola.
- Degradazione ordinata: API community → API ufficiale → copia del registratore (`recorder/record.mjs:85+`, banner "stale" nella pagina).
- Test di regressione per ogni bug già visto in produzione, e una pipeline di verifica dell'accuratezza che rigioca le previsioni sul passato.

## Risultati

| ID | Gravità | Tema | Dove |
|----|---------|------|------|
| ARCH-01 | **Alta** | Perdita totale dello stato accumulato se il recupero della storia fallisce all'avvio | `.github/workflows/record.yml:36`, `recorder/record.mjs:80` |
| ARCH-02 | **Alta** | Nessun backup del branch `data`: un commit, riscritto con force-push ogni 10 min | `.github/workflows/record.yml:41-44` |
| ARCH-03 | Media | Il registratore gira sul codice letto all'avvio per ~5 h 40 min: ogni rilascio richiede annullare e riavviare a mano | `.github/workflows/record.yml:24-37` |
| ARCH-04 | Media | 12 file che condividono una sola chiusura senza linter: un nome rimosso in un file esplode solo a runtime | `tools/build.py:40`, `src/app/*` |
| ARCH-05 | Media | Dipendenza critica da raw.githubusercontent.com per i dati del registratore e per i nomi | `src/app/01-intel.js:25`, `src/app/00-core.js:2-6` |
| ARCH-06 | Bassa | Responsabilità fuori posto: impostazioni, testi e cambio vista stanno nel file dell'immagine da condividere | `src/app/10-share-image.js:372-420` |
| ARCH-07 | Bassa | Schema di `history.json` senza versione unica: versioni sparse per sottoparti | `recorder/measure.mjs:23`, `recorder/record.mjs:353` |
| ARCH-08 | Bassa | Parametri del modello esposti come oggetto mutabile | `src/engine.js:211` |

### ARCH-01 — Uno storico vuoto può sovrascrivere quello vero (Alta)
`record.yml:36` scarica `history.json` con `git fetch … && git show … > "$H" || echo '{}' > "$H"`. Se il fetch fallisce per un motivo temporaneo (rete, rate limit di GitHub), il registratore parte da `{}`, `record.mjs:80` lo accetta in silenzio (`catch { /* first run */ }`) e al primo snapshot fa force-push sul branch `data`. Si perdono, senza modo di ricostruirli: le misure di DSS/HOD (`hist.measure`), lo storico delle difese (`hist.defRecord`), le previsioni registrate per l'affidabilità live (`hist.calls`), i dati helldiversstats già scaricati.
**Rimedio**: distinguere "branch assente" (primo avvio, ok `{}`) da "fetch fallito" (riprova e, se fallisce ancora, interrompi senza pushare); in `record.mjs` rifiutare di scrivere se lo storico letto è vuoto ma il branch esiste.

### ARCH-02 — Nessuna copia di sicurezza (Alta)
Il branch `data` è un singolo commit sostituito ogni 10 minuti (`record.yml:41-44`, `git init` + `push -f`). Un bug del registratore che corrompe un campo si propaga in 10 minuti e la versione buona non esiste più. È lo stesso rischio di ARCH-01 visto da un'altra parte.
**Rimedio**: una copia giornaliera (es. branch `data-backup` con un commit al giorno, o artifact dell'Action con retention 30 giorni) di `history.json`.

### ARCH-03 — Rilasci del registratore manuali (Media)
Ogni run fa checkout all'inizio e gira 340 minuti (`record.yml:24-37`); il codice nuovo entra solo al run successivo. Finora ogni rilascio ha richiesto di annullare il run e rilanciarlo a mano, con il rischio di sovrapposizioni (successo il 31 ottobre: un run schedulato con codice vecchio ha tenuto in coda quello nuovo).
**Rimedio**: nel ciclo, a ogni iterazione `git fetch origin main` e uscita pulita se `HEAD` è cambiato (il passo "Start the next run" riparte già da solo).

### ARCH-04 — Chiusura condivisa senza controllo statico (Media)
`tools/build.py:40` unisce `src/app/*.js` in un'unica IIFE: ogni file usa funzioni e variabili degli altri senza import. Rimuovere o rinominare un nome (successo con la rimozione dell'italiano: `LANG`, `tHas`) si scopre solo eseguendo la pagina. Oggi lo prendono i test Playwright, ma solo sui percorsi esercitati.
**Rimedio**: un passo `eslint --no-eslintrc --env browser --rule 'no-undef: error'` sul file assemblato `build/app.js` in CI (o `node --check` + un elenco dei globali ammessi).

### ARCH-05 — Un unico CDN per i dati (Media)
Dati del registratore (`01-intel.js:25`) e nomi di nemici/armi (`00-core.js:2-6`) arrivano da raw.githubusercontent.com. Se GitHub raw è lento o limita le richieste, la pagina perde storico, registro del Comando, archivio e nomi insieme. I nomi hanno già una cache locale di 24 h; i dati del registratore no.
**Rimedio**: servire i JSON del registratore anche da GitHub Pages (pubblicazione su un percorso `/data/`) e usare raw come riserva, o viceversa.

### ARCH-06 — File con troppi compiti (Bassa)
`10-share-image.js` contiene anche `setView`, `bindSettings`, `applyTexts` (righe 372-420). Rende il file difficile da trovare per chi lavora sulle impostazioni.
**Rimedio**: spostarli in un `10a-settings-view.js`.

### ARCH-07 — Versionamento dello stato sparso (Bassa)
Lo schema di `history.json` cambia per pezzi con versioni locali (`measure.v`, `retroV`, `hist.v: 1` mai aggiornato). Funziona, ma una migrazione globale non ha un punto unico.
**Rimedio**: una sola `hist.schema` con funzioni di migrazione in ordine.

### ARCH-08 — Parametri modificabili da fuori (Bassa)
`ENGINE.FC` è esportato e mutabile (`engine.js:211`): comodo per la taratura, ma qualunque codice della pagina può cambiarlo.
**Rimedio**: `Object.freeze` in produzione, con un override esplicito solo nei test di taratura.

## Conteggio

| Gravità | N. |
|---------|----|
| Critica | 0 |
| Alta | 2 |
| Media | 3 |
| Bassa | 3 |

Confidenza: alta per ARCH-01/02/03 (verificati sul codice e accaduti in parte), media per gli altri.
